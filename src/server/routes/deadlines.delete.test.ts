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

describe('CRUD-04: DELETE /api/deadlines/:id', () => {
  beforeEach(() => {
    cleanTables()
    seedOneType()
  })

  it.todo('204: happy path — deadline removed; response has no body')
  it.todo('404: missing id — returns not_found when deadline does not exist')
  it.todo('400: invalid id — non-integer id returns validation_failed')
  it.todo('500: db_error — wraps unexpected database exception in structured error')
})
