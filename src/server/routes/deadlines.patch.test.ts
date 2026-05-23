import { describe, it, beforeEach } from 'vitest'
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

describe('CRUD-03: PATCH /api/deadlines/:id', () => {
  beforeEach(() => {
    cleanTables()
    seedOneType()
  })

  it.todo('200: happy path — returns updated deadline with all changed fields')
  it.todo('200: partial update — single field (date) only; other fields unchanged')
  it.todo('404: missing id — returns not_found error')
  it.todo('422: empty body — refine failure; at-least-one-field required')
  it.todo('422: invalid completedAt shape — rejects non-ISO string')
  it.todo('500: db_error — wraps unexpected database exception in structured error')
})
