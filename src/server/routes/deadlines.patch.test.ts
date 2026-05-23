import { describe, it, expect, beforeEach } from 'vitest'
import { app } from '../index.js'
import { sqlite } from '../db.js'

function cleanTables(): void {
  sqlite.exec('DELETE FROM deadlines')
  sqlite.exec('DELETE FROM deadline_types')
}

function seedOneType(): void {
  sqlite
    .prepare('INSERT OR IGNORE INTO deadline_types (id, name, color) VALUES (?, ?, ?)')
    .run(1, 'Filing', '#1D4ED8') // allow-hex: test fixture
}

function seedOneDeadline(): number {
  const row = sqlite
    .prepare(
      'INSERT INTO deadlines (date, caseLabel, typeId) VALUES (?, ?, ?) RETURNING id'
    )
    .get('2026-06-15', 'Smith v. Jones', 1) as { id: number }
  return row.id
}

describe('CRUD-03: PATCH /api/deadlines/:id', () => {
  beforeEach(() => {
    cleanTables()
    seedOneType()
  })

  it('200: happy path — returns updated deadline with changed caseLabel', async () => {
    const id = seedOneDeadline()
    const res = await app.request(`/api/deadlines/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseLabel: 'New Label' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.caseLabel).toBe('New Label')
    expect(body.id).toBe(id)
  })

  it('200: partial update — single field (date only); other fields unchanged', async () => {
    const id = seedOneDeadline()
    const res = await app.request(`/api/deadlines/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: '2026-12-31' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.date).toBe('2026-12-31')
    expect(body.caseLabel).toBe('Smith v. Jones')
  })

  it('200: mark complete — PATCH { completedAt: ISO timestamp } sets completedAt', async () => {
    const id = seedOneDeadline()
    const ts = new Date().toISOString()
    const res = await app.request(`/api/deadlines/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completedAt: ts }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.completedAt).not.toBeNull()
  })

  it('200: unmark complete — PATCH { completedAt: null } clears completedAt', async () => {
    const id = seedOneDeadline()
    // First mark complete
    const ts = new Date().toISOString()
    await app.request(`/api/deadlines/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completedAt: ts }),
    })
    // Then unmark
    const res = await app.request(`/api/deadlines/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completedAt: null }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.completedAt).toBeNull()
  })

  it('404: missing id — returns not_found when deadline does not exist', async () => {
    const res = await app.request('/api/deadlines/99999', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseLabel: 'Ghost' }),
    })
    expect(res.status).toBe(404)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('not_found')
  })

  it('422: empty body — refine failure; at-least-one-field required', async () => {
    const id = seedOneDeadline()
    const res = await app.request(`/api/deadlines/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(422)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('validation_failed')
  })

  it('422: unknown key rejected by .strict()', async () => {
    const id = seedOneDeadline()
    const res = await app.request(`/api/deadlines/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unknownField: 'value' }),
    })
    expect(res.status).toBe(422)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('validation_failed')
  })

  it('422: invalid completedAt shape — rejects non-ISO string', async () => {
    const id = seedOneDeadline()
    const res = await app.request(`/api/deadlines/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completedAt: 'not-a-date' }),
    })
    expect(res.status).toBe(422)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('validation_failed')
  })

  it('400: invalid id — non-integer id returns validation_failed', async () => {
    const res = await app.request('/api/deadlines/abc', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseLabel: 'Test' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('validation_failed')
  })

  it('400: negative id returns validation_failed', async () => {
    const res = await app.request('/api/deadlines/-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caseLabel: 'Test' }),
    })
    expect(res.status).toBe(400)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('validation_failed')
  })
})
