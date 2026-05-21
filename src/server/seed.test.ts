/**
 * Tests for seedDeadlineTypes() — DATA-05
 *
 * Uses the real data/deadlines.db with DELETE FROM deadline_types in beforeEach
 * to isolate each test. The seed function is idempotent so this approach is safe.
 *
 * Note: test isolation relies on DELETE clearing the table before each test.
 * The real DB is used because setting up an in-memory DB would require
 * re-running drizzle-kit push or manually replicating the CREATE TABLE DDL —
 * testing against the actual schema is more reliable.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { sqlite } from './db.js'
import { seedDeadlineTypes } from './seed.js'

// Snapshot of rows before we start messing with the table
let originalRows: { id: number; name: string; color: string; createdAt: string }[] = []

beforeEach(() => {
  // Save original rows so we can restore them after each test
  originalRows = sqlite.prepare('SELECT * FROM deadline_types ORDER BY id').all() as typeof originalRows
  // Clear table so each test starts fresh
  sqlite.prepare('DELETE FROM deadline_types').run()
})

afterEach(() => {
  // Restore original rows after each test
  sqlite.prepare('DELETE FROM deadline_types').run()
  if (originalRows.length > 0) {
    const insert = sqlite.prepare(
      'INSERT INTO deadline_types (id, name, color, createdAt) VALUES (?, ?, ?, ?)'
    )
    const insertAll = sqlite.transaction(
      (rows: typeof originalRows) => {
        for (const r of rows) insert.run(r.id, r.name, r.color, r.createdAt)
      }
    )
    insertAll(originalRows)
  }
})

describe('seedDeadlineTypes', () => {
  it('seeds exactly 9 rows on empty table', () => {
    // Verify table is empty
    const before = sqlite.prepare('SELECT COUNT(*) as c FROM deadline_types').get() as { c: number }
    expect(before.c).toBe(0)

    seedDeadlineTypes()

    const after = sqlite.prepare('SELECT COUNT(*) as c FROM deadline_types').get() as { c: number }
    expect(after.c).toBe(9)
  })

  it('idempotent: second call inserts 0 additional rows', () => {
    seedDeadlineTypes()
    seedDeadlineTypes()

    const count = sqlite.prepare('SELECT COUNT(*) as c FROM deadline_types').get() as { c: number }
    expect(count.c).toBe(9)
  })

  it('names and colors match UI-SPEC exactly', () => {
    seedDeadlineTypes()

    const rows = sqlite.prepare('SELECT name, color FROM deadline_types').all() as { name: string; color: string }[]

    const expected = [
      { name: 'Filing',                 color: '#1D4ED8' },
      { name: 'Hearing',                color: '#B91C1C' },
      { name: 'Deposition',             color: '#C2410C' },
      { name: 'Statute of Limitations', color: '#7C3AED' },
      { name: 'Response/Opposition',    color: '#15803D' },
      { name: 'Status Conference',      color: '#0F766E' },
      { name: 'Discovery Cutoff',       color: '#B45309' },
      { name: 'Trial',                  color: '#9F1239' },
      { name: 'Other',                  color: '#374151' },
    ]

    expect(rows).toEqual(expect.arrayContaining(
      expected.map(e => expect.objectContaining(e))
    ))
    expect(rows).toHaveLength(9)
  })

  it('re-seeding does not overwrite a manually-edited color', () => {
    // Insert Filing with a custom color
    sqlite.prepare(
      "INSERT INTO deadline_types (name, color) VALUES ('Filing', '#000000')"
    ).run()

    // Seed — should not overwrite the existing 'Filing' row (INSERT OR IGNORE)
    seedDeadlineTypes()

    const filing = sqlite.prepare(
      "SELECT color FROM deadline_types WHERE name = 'Filing'"
    ).get() as { color: string }

    // Filing color should still be the manually-inserted value, NOT the seed value
    expect(filing.color).toBe('#000000')

    // Total rows: 1 Filing (existing) + 8 new (other types) = 9
    const count = sqlite.prepare('SELECT COUNT(*) as c FROM deadline_types').get() as { c: number }
    expect(count.c).toBe(9)
  })
})
