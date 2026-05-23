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

describe('CRUD-04: DELETE /api/deadlines/:id', () => {
  beforeEach(() => {
    cleanTables()
    seedOneType()
  })

  it('204: happy path — deadline removed; response has no body', async () => {
    const id = seedOneDeadline()
    const res = await app.request(`/api/deadlines/${id}`, {
      method: 'DELETE',
    })
    expect(res.status).toBe(204)
    // Verify the row is gone
    const row = sqlite.prepare('SELECT id FROM deadlines WHERE id = ?').get(id)
    expect(row).toBeUndefined()
  })

  it('404: missing id — returns not_found when deadline does not exist', async () => {
    const res = await app.request('/api/deadlines/99999', {
      method: 'DELETE',
    })
    expect(res.status).toBe(404)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('not_found')
  })

  it('400: invalid id — non-integer id returns validation_failed', async () => {
    const res = await app.request('/api/deadlines/abc', {
      method: 'DELETE',
    })
    expect(res.status).toBe(400)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('validation_failed')
  })

  it('400: negative id returns validation_failed', async () => {
    const res = await app.request('/api/deadlines/-5', {
      method: 'DELETE',
    })
    expect(res.status).toBe(400)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('validation_failed')
  })
})
