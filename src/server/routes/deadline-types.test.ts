import { describe, it, expect, beforeEach } from 'vitest'
import { app } from '../index.js'
import { sqlite } from '../db.js'

function cleanTables(): void {
  sqlite.exec('DELETE FROM deadlines')
  sqlite.exec('DELETE FROM deadline_types')
}

function seedOtherType(): void {
  sqlite
    .prepare('INSERT OR IGNORE INTO deadline_types (id, name, color) VALUES (?, ?, ?)')
    .run(1, 'Other', '#6B7280') // allow-hex: test fixture — seed "Other" protected type
}

function seedCustomType(name: string, color: string): number {
  const row = sqlite
    .prepare('INSERT INTO deadline_types (name, color) VALUES (?, ?) RETURNING id')
    .get(name, color) as { id: number }
  return row.id
}

function seedDeadlineForType(typeId: number): void {
  sqlite
    .prepare('INSERT INTO deadlines (date, caseLabel, typeId) VALUES (?, ?, ?)')
    .run('2026-06-15', 'Case A', typeId)
}

describe('TYPE-01..05: /api/deadline-types', () => {
  beforeEach(() => {
    cleanTables()
    seedOtherType()
  })

  // POST /api/deadline-types
  it('POST 201: happy path — creates type with name + color; returns created shape', async () => {
    const res = await app.request('/api/deadline-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Filing', color: '#1D4ED8' }), // allow-hex: test fixture
    })
    expect(res.status).toBe(201)
    const body = await res.json() as Record<string, unknown>
    expect(body.id).toBeDefined()
    expect(body.name).toBe('Filing')
    expect(body.color).toBe('#1D4ED8') // allow-hex: test fixture
    expect(typeof body.createdAt).toBe('string')
  })

  it('POST 409: type_name_taken — duplicate name returns conflict error', async () => {
    // First insert succeeds
    await app.request('/api/deadline-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'DuplicateName', color: '#1D4ED8' }), // allow-hex: test fixture
    })
    // Second with same name must fail
    const res = await app.request('/api/deadline-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'DuplicateName', color: '#2563EB' }), // allow-hex: test fixture
    })
    expect(res.status).toBe(409)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('type_name_taken')
  })

  it('POST 422: invalid color regex — non-hex string rejected by Zod', async () => {
    const res = await app.request('/api/deadline-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hearing', color: 'red' }),
    })
    expect(res.status).toBe(422)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('validation_failed')
  })

  it('POST 422: short hex (3-char) rejected by Zod', async () => {
    const res = await app.request('/api/deadline-types', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hearing', color: '#FFF' }),
    })
    expect(res.status).toBe(422)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('validation_failed')
  })

  // PATCH /api/deadline-types/:id
  it('PATCH 200: rename happy — name updated; other fields unchanged', async () => {
    const id = seedCustomType('Filing', '#1D4ED8') // allow-hex: test fixture
    const res = await app.request(`/api/deadline-types/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Filing Name' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.name).toBe('New Filing Name')
    expect(body.color).toBe('#1D4ED8') // allow-hex: test fixture — color unchanged
  })

  it('PATCH 200: recolor happy — color updated; name unchanged', async () => {
    const id = seedCustomType('Hearing', '#1D4ED8') // allow-hex: test fixture
    const res = await app.request(`/api/deadline-types/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color: '#DC2626' }), // allow-hex: test fixture
    })
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.color).toBe('#DC2626') // allow-hex: test fixture
    expect(body.name).toBe('Hearing')
  })

  it('PATCH 409: type_protected — "Other" cannot be renamed (CR-01 bypass guard)', async () => {
    // "Other" is seeded with id=1 in beforeEach
    const res = await app.request('/api/deadline-types/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Misc' }),
    })
    expect(res.status).toBe(409)
    const body = await res.json() as { error: { code: string; message: string } }
    expect(body.error.code).toBe('type_protected')
    expect(body.error.message).toBe('The "Other" type cannot be renamed.')
  })

  it('PATCH 409: type_protected — case-insensitive "other" cannot be renamed', async () => {
    const id = seedCustomType('other', '#9CA3AF') // allow-hex: test fixture
    const res = await app.request(`/api/deadline-types/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'AnotherName' }),
    })
    expect(res.status).toBe(409)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('type_protected')
  })

  it('PATCH 200: "Other" recolor allowed — only name is protected', async () => {
    // "Other" is seeded with id=1 in beforeEach
    const res = await app.request('/api/deadline-types/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ color: '#2563EB' }), // allow-hex: test fixture
    })
    expect(res.status).toBe(200)
    const body = await res.json() as Record<string, unknown>
    expect(body.name).toBe('Other')
    expect(body.color).toBe('#2563EB') // allow-hex: test fixture
  })

  it('PATCH 409: name_taken — rename to existing name returns conflict', async () => {
    seedCustomType('Filing', '#1D4ED8') // allow-hex: test fixture
    const id2 = seedCustomType('Hearing', '#16A34A') // allow-hex: test fixture
    const res = await app.request(`/api/deadline-types/${id2}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Filing' }), // collides with existing
    })
    expect(res.status).toBe(409)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('type_name_taken')
  })

  it('PATCH 422: empty body returns validation_failed', async () => {
    const id = seedCustomType('Filing', '#1D4ED8') // allow-hex: test fixture
    const res = await app.request(`/api/deadline-types/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    expect(res.status).toBe(422)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('validation_failed')
  })

  it('PATCH 404: non-existent id returns not_found', async () => {
    const res = await app.request('/api/deadline-types/99999', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Ghost' }),
    })
    expect(res.status).toBe(404)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('not_found')
  })

  // DELETE /api/deadline-types/:id
  it('DELETE 204: happy path — type removed; no body in response', async () => {
    const id = seedCustomType('Deposition', '#9333EA') // allow-hex: test fixture
    const res = await app.request(`/api/deadline-types/${id}`, {
      method: 'DELETE',
    })
    expect(res.status).toBe(204)
    // Verify the row is gone
    const row = sqlite.prepare('SELECT id FROM deadline_types WHERE id = ?').get(id)
    expect(row).toBeUndefined()
  })

  // TYPE-05: case-insensitive "Other" protection — test three name variants
  // "Other" is already seeded via seedOtherType() with id=1 in beforeEach
  it('DELETE 409: type_protected — "Other" (mixed case) cannot be deleted', async () => {
    const res = await app.request('/api/deadline-types/1', { method: 'DELETE' })
    expect(res.status).toBe(409)
    const body = await res.json() as { error: { code: string; message: string } }
    expect(body.error.code).toBe('type_protected')
    expect(body.error.message).toBe('The "Other" type cannot be deleted.')
  })

  it('DELETE 409: type_protected — "OTHER" (all caps) cannot be deleted', async () => {
    const id = seedCustomType('OTHER', '#9CA3AF') // allow-hex: test fixture
    const res = await app.request(`/api/deadline-types/${id}`, { method: 'DELETE' })
    expect(res.status).toBe(409)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('type_protected')
  })

  it('DELETE 409: type_protected — "other" (all lower) cannot be deleted', async () => {
    const id = seedCustomType('other', '#9CA3AF') // allow-hex: test fixture
    const res = await app.request(`/api/deadline-types/${id}`, { method: 'DELETE' })
    expect(res.status).toBe(409)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('type_protected')
  })

  // TYPE-04: in-use guard with real count
  it('DELETE 409: type_in_use — 409 with N count when deadlines reference the type', async () => {
    const id = seedCustomType('Deposition', '#9333EA') // allow-hex: test fixture
    // Seed 2 deadlines referencing this type
    seedDeadlineForType(id)
    seedDeadlineForType(id)
    const res = await app.request(`/api/deadline-types/${id}`, { method: 'DELETE' })
    expect(res.status).toBe(409)
    const body = await res.json() as { error: { code: string; message: string } }
    expect(body.error.code).toBe('type_in_use')
    // Message must include the real count "2"
    expect(body.error.message).toContain('2')
    expect(body.error.message).toContain('Reassign them first.')
  })

  it('DELETE 404: missing — non-existent id returns not_found', async () => {
    const res = await app.request('/api/deadline-types/99999', { method: 'DELETE' })
    expect(res.status).toBe(404)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('not_found')
  })

  it('DELETE 400: invalid id returns validation_failed', async () => {
    const res = await app.request('/api/deadline-types/abc', { method: 'DELETE' })
    expect(res.status).toBe(400)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('validation_failed')
  })
})
