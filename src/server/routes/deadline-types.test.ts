import { describe, it, beforeEach } from 'vitest'
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

describe('TYPE-01..05: /api/deadline-types', () => {
  beforeEach(() => {
    cleanTables()
    seedOtherType()
  })

  // POST /api/deadline-types
  it.todo('POST 201: happy path — creates type with name + color; returns created shape')
  it.todo('POST 409: type_name_taken — duplicate name returns conflict error')
  it.todo('POST 422: invalid color regex — non-hex string rejected by Zod')

  // PATCH /api/deadline-types/:id
  it.todo('PATCH 200: rename happy — name updated; other fields unchanged')
  it.todo('PATCH 200: recolor happy — color updated; name unchanged')
  it.todo('PATCH 409: name_taken — rename to existing name returns conflict')

  // DELETE /api/deadline-types/:id
  it.todo('DELETE 204: happy path — type removed; no body in response')
  it.todo('DELETE 409: type_protected — "Other" name (case-insensitive) cannot be deleted')
  it.todo('DELETE 409: type_in_use — 409 with N count when deadlines reference the type')
  it.todo('DELETE 404: missing — non-existent id returns not_found')
})
