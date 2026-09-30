// Routes: POST /api/deadlines/extract (proposals only) and POST /api/deadlines/bulk
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { app } from '../index.js'
import { sqlite } from '../db.js'
import { onMutation } from '../queries.js'
import { __resetExtractModel, setExtractModel, type ExtractRequest, type RawExtraction } from '../lib/deadline-extractor.js'

const item = (over: Partial<RawExtraction>): RawExtraction => ({
  date: '2026-11-02', caseLabel: '', typeName: 'Filing', title: 'Opposition Due', notes: '',
  dateBasis: 'stated', basis: '', sourceText: 'Opposition due November 2, 2026.', ...over,
})

function post(url: string, body: unknown) {
  return app.request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
}

describe('/api/deadlines/extract + /bulk', () => {
  let savedKey: string | undefined
  beforeEach(() => {
    savedKey = process.env.ANTHROPIC_API_KEY
    process.env.ANTHROPIC_API_KEY = 'test-key'
    sqlite.exec('DELETE FROM deadlines; DELETE FROM deadline_types')
    const t = sqlite.prepare('INSERT INTO deadline_types (id, name, color) VALUES (?, ?, ?)')
    t.run(1, 'Filing', '#1D4ED8'); t.run(2, 'Hearing', '#B91C1C'); t.run(9, 'Other', '#374151')
    sqlite.prepare("INSERT INTO deadlines (date, caseLabel, typeId) VALUES ('2026-06-01', 'Smith v. Jones', 1)").run()
  })
  afterEach(() => {
    __resetExtractModel()
    if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = savedKey
  })

  it('IM1: returns proposals: types resolved, case names snapped to existing cases, sorted by date; nothing saved', async () => {
    let seen: ExtractRequest | null = null
    setExtractModel(async (req) => {
      seen = req
      return [
        item({ date: '2026-12-01', caseLabel: 'smith v jones', typeName: 'hearing', title: 'Hearing on MSJ', notes: 'Dept. 14, 8:30 AM' }),
        item({ date: '2026-11-02', caseLabel: 'Smith v Jones' }),
        item({ date: '2026-11-20', typeName: 'Deposition', title: 'Smith Deposition', dateBasis: 'computed', basis: '10 days before hearing' }),
      ]
    })
    const res = await post('/api/deadlines/extract', { text: 'ORDER ...', caseLabel: null })
    expect(res.status).toBe(200)
    const { proposals } = await res.json()
    expect(proposals.map((p: { date: string }) => p.date)).toEqual(['2026-11-02', '2026-11-20', '2026-12-01'])
    expect(proposals[0]).toMatchObject({ caseLabel: 'Smith v. Jones', typeId: 1, title: 'Opposition Due', dateBasis: 'stated' })
    expect(proposals[1]).toMatchObject({ caseLabel: '', typeId: 9, dateBasis: 'computed', basis: '10 days before hearing' })
    expect(proposals[2]).toMatchObject({ caseLabel: 'Smith v. Jones', typeId: 2, notes: 'Dept. 14, 8:30 AM' })
    expect(seen!.knownCases).toEqual(['Smith v. Jones'])
    expect(seen!.typeNames).toEqual(expect.arrayContaining(['Filing', 'Hearing', 'Other']))
    expect(sqlite.prepare('SELECT count(*) n FROM deadlines').get()).toEqual({ n: 1 })
  })

  it('IM2: the case hint fills in missing cases and is passed to the model', async () => {
    let hint: string | null = null
    setExtractModel(async (req) => { hint = req.caseHint; return [item({})] })
    const { proposals } = await (await post('/api/deadlines/extract', { text: 'x', caseLabel: 'Doe v. Roe' })).json()
    expect(hint).toBe('Doe v. Roe')
    expect(proposals[0].caseLabel).toBe('Doe v. Roe')
  })

  it('IM3: drops impossible dates and exact duplicates', async () => {
    setExtractModel(async () => [item({ date: '2026-02-30' }), item({}), item({}), item({ date: 'soon' })])
    const { proposals } = await (await post('/api/deadlines/extract', { text: 'x' })).json()
    expect(proposals).toHaveLength(1)
  })

  it('IM4: 503 when no API key; 422 for empty/oversized text; model failures are 422 with a message', async () => {
    delete process.env.ANTHROPIC_API_KEY
    expect((await post('/api/deadlines/extract', { text: 'x' })).status).toBe(503)
    process.env.ANTHROPIC_API_KEY = 'test-key'
    expect((await post('/api/deadlines/extract', { text: '   ' })).status).toBe(422)
    expect((await post('/api/deadlines/extract', { text: 'a'.repeat(50_001) })).status).toBe(422)
    setExtractModel(async () => { throw new Error('boom') })
    const res = await post('/api/deadlines/extract', { text: 'x' })
    expect(res.status).toBe(422)
    expect((await res.json()).error.code).toBe('extract_failed')
  })

  it('IM5: bulk saves all rows in one go and wakes the wallpaper once', async () => {
    const spy = vi.fn()
    onMutation(spy)
    const res = await post('/api/deadlines/bulk', { deadlines: [
      { date: '2026-11-02', caseLabel: 'Smith v. Jones', typeId: 1, description: 'Opposition Due' },
      { date: '2026-12-01', caseLabel: 'Smith v. Jones', typeId: 2, description: 'Hearing on MSJ\nDept. 14' },
    ] })
    expect(res.status).toBe(201)
    expect(await res.json()).toEqual({ created: 2 })
    expect(sqlite.prepare('SELECT count(*) n FROM deadlines').get()).toEqual({ n: 3 })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('IM6: bulk is all-or-nothing: one invalid row rejects the whole batch', async () => {
    const res = await post('/api/deadlines/bulk', { deadlines: [
      { date: '2026-11-02', caseLabel: 'Smith v. Jones', typeId: 1 },
      { date: '2026-13-45', caseLabel: 'Smith v. Jones', typeId: 1 },
    ] })
    expect(res.status).toBe(422)
    expect(sqlite.prepare('SELECT count(*) n FROM deadlines').get()).toEqual({ n: 1 })

    // A database error mid-batch (unknown type id violates the foreign key) rolls back
    const res2 = await post('/api/deadlines/bulk', { deadlines: [
      { date: '2026-11-02', caseLabel: 'Smith v. Jones', typeId: 1 },
      { date: '2026-11-03', caseLabel: 'Smith v. Jones', typeId: 999 },
    ] })
    expect(res2.status).toBe(500)
    expect(sqlite.prepare('SELECT count(*) n FROM deadlines').get()).toEqual({ n: 1 })
  })
})
