// Routes: /api/cases (Settings > Cases): summaries, rename/merge, archive
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { app } from '../index.js'
import { sqlite } from '../db.js'
import { onMutation } from '../queries.js'

function seed(): void {
  sqlite.exec('DELETE FROM deadlines; DELETE FROM deadline_types; DELETE FROM case_colors; DELETE FROM archived_cases')
  sqlite.prepare('INSERT INTO deadline_types (id, name, color) VALUES (1, ?, ?)').run('Filing', '#1D4ED8')
  const add = sqlite.prepare('INSERT INTO deadlines (date, caseLabel, typeId, completedAt) VALUES (?, ?, 1, ?)')
  add.run('2026-06-01', 'Smith v. Jones', null)
  add.run('2026-06-02', 'Smith v. Jones', '2026-05-01T00:00:00Z')
  add.run('2026-06-03', 'smith v jones', null)
  add.run('2026-06-04', 'Doe v. Roe', null)
}

const json = (method: string, url: string, body: unknown) =>
  app.request(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })

async function cases(): Promise<Array<{ caseLabel: string; openCount: number; totalCount: number; archived: boolean }>> {
  return (await app.request('/api/cases')).json()
}
const labelsInDb = () =>
  sqlite.prepare('SELECT caseLabel, count(*) n FROM deadlines GROUP BY caseLabel ORDER BY caseLabel').all()

describe('/api/cases', () => {
  beforeEach(seed)

  it('CA1: GET lists each case with open/total counts', async () => {
    expect(await cases()).toEqual([
      { caseLabel: 'Doe v. Roe', openCount: 1, totalCount: 1, archived: false },
      { caseLabel: 'Smith v. Jones', openCount: 1, totalCount: 2, archived: false },
      { caseLabel: 'smith v jones', openCount: 1, totalCount: 1, archived: false },
    ])
  })

  it('CA2: rename changes every deadline using exactly that name', async () => {
    const res = await json('POST', '/api/cases/rename', { from: 'Doe v. Roe', to: 'Doe v. Roe Corp.' })
    expect(await res.json()).toEqual({ changed: 1 })
    expect(labelsInDb()).toContainEqual({ caseLabel: 'Doe v. Roe Corp.', n: 1 })
    expect(labelsInDb()).not.toContainEqual(expect.objectContaining({ caseLabel: 'Doe v. Roe' }))
  })

  it('CA3: renaming onto an existing case merges them', async () => {
    await json('POST', '/api/cases/rename', { from: 'smith v jones', to: 'Smith v. Jones' })
    expect(labelsInDb()).toEqual([{ caseLabel: 'Doe v. Roe', n: 1 }, { caseLabel: 'Smith v. Jones', n: 3 }])
  })

  it('CA4: a chosen color follows the renamed case; the destination keeps its own if it has one', async () => {
    sqlite.prepare("INSERT INTO case_colors (caseKey, caseLabel, color) VALUES ('doe v. roe', 'Doe v. Roe', '#e6194B')").run()
    await json('POST', '/api/cases/rename', { from: 'Doe v. Roe', to: 'Doe Holdings' })
    expect(sqlite.prepare('SELECT caseKey, color FROM case_colors').all()).toEqual([{ caseKey: 'doe holdings', color: '#e6194B' }])

    sqlite.prepare("INSERT INTO case_colors (caseKey, caseLabel, color) VALUES ('smith v. jones', 'Smith v. Jones', '#3cb44b')").run()
    await json('POST', '/api/cases/rename', { from: 'Doe Holdings', to: 'Smith v. Jones' })
    const colors = sqlite.prepare('SELECT caseKey, color FROM case_colors ORDER BY caseKey').all()
    expect(colors).toEqual([{ caseKey: 'smith v. jones', color: '#3cb44b' }])
  })

  it('CA5: rename of an unknown case is 404; invalid bodies are 422', async () => {
    expect((await json('POST', '/api/cases/rename', { from: 'Nobody', to: 'X' })).status).toBe(404)
    expect((await json('POST', '/api/cases/rename', { from: 'Doe v. Roe', to: '  ' })).status).toBe(422)
    expect((await json('POST', '/api/cases/rename', { from: 'Doe v. Roe' })).status).toBe(422)
  })

  it('CA6: archive / unarchive; archived state is reported per case and matched loosely', async () => {
    expect((await json('PUT', '/api/cases/archive', { caseLabel: 'Doe v. Roe', archived: true })).status).toBe(204)
    expect((await cases()).find(c => c.caseLabel === 'Doe v. Roe')!.archived).toBe(true)
    await json('PUT', '/api/cases/archive', { caseLabel: 'Doe v. Roe', archived: true }) // idempotent
    await json('PUT', '/api/cases/archive', { caseLabel: ' doe v. ROE ', archived: false })
    expect((await cases()).find(c => c.caseLabel === 'Doe v. Roe')!.archived).toBe(false)
  })

  it('CA7: archiving never hides deadlines (they are still returned by /api/deadlines)', async () => {
    await json('PUT', '/api/cases/archive', { caseLabel: 'Doe v. Roe', archived: true })
    const all: Array<{ caseLabel: string }> = await (await app.request('/api/deadlines')).json()
    expect(all.some(d => d.caseLabel === 'Doe v. Roe')).toBe(true)
  })

  it('CA8: a rename wakes the wallpaper worker; a no-op rename does not', async () => {
    const spy = vi.fn()
    onMutation(spy)
    await json('POST', '/api/cases/rename', { from: 'Doe v. Roe', to: 'Doe Holdings' })
    expect(spy).toHaveBeenCalledTimes(1)
    await json('POST', '/api/cases/rename', { from: 'Nobody', to: 'X' })
    expect(spy).toHaveBeenCalledTimes(1)
  })
})
