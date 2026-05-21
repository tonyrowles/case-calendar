/**
 * Tests for seedDeadlineTypes() — DATA-05
 *
 * Uses an in-memory SQLite database with the deadline_types schema
 * created directly. This avoids concurrent access issues with the
 * real data/deadlines.db when test files run in parallel.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { seedDeadlineTypes } from './seed.js'

// Create a fresh in-memory DB for each test to guarantee isolation
function createTestDb() {
  const db = new Database(':memory:')
  // Create the deadline_types table matching the Drizzle schema
  db.exec(`
    CREATE TABLE deadline_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      color TEXT NOT NULL,
      "createdAt" TEXT NOT NULL DEFAULT (CURRENT_TIMESTAMP)
    )
  `)
  return db
}

describe('seedDeadlineTypes', () => {
  it('seeds exactly 9 rows on empty table', () => {
    const db = createTestDb()
    const before = db.prepare('SELECT COUNT(*) as c FROM deadline_types').get() as { c: number }
    expect(before.c).toBe(0)

    seedDeadlineTypes(db)

    const after = db.prepare('SELECT COUNT(*) as c FROM deadline_types').get() as { c: number }
    expect(after.c).toBe(9)
    db.close()
  })

  it('idempotent: second call inserts 0 additional rows', () => {
    const db = createTestDb()
    seedDeadlineTypes(db)
    seedDeadlineTypes(db)

    const count = db.prepare('SELECT COUNT(*) as c FROM deadline_types').get() as { c: number }
    expect(count.c).toBe(9)
    db.close()
  })

  it('names and colors match UI-SPEC exactly', () => {
    const db = createTestDb()
    seedDeadlineTypes(db)

    const rows = db.prepare('SELECT name, color FROM deadline_types').all() as { name: string; color: string }[]

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
    db.close()
  })

  it('re-seeding does not overwrite a manually-edited color', () => {
    const db = createTestDb()

    // Insert Filing with a custom color
    db.prepare(
      "INSERT INTO deadline_types (name, color) VALUES ('Filing', '#000000')"
    ).run()

    // Seed — INSERT OR IGNORE should leave existing Filing row untouched
    seedDeadlineTypes(db)

    const filing = db.prepare(
      "SELECT color FROM deadline_types WHERE name = 'Filing'"
    ).get() as { color: string }

    // Filing color should still be the manually-inserted value, NOT the seed value
    expect(filing.color).toBe('#000000')

    // Total: 1 Filing (existing) + 8 new (other types) = 9
    const count = db.prepare('SELECT COUNT(*) as c FROM deadline_types').get() as { c: number }
    expect(count.c).toBe(9)
    db.close()
  })
})
