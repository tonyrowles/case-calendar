/**
 * Idempotent seed for the 9 deadline types (DATA-05).
 * Exported for Plan 01-02's index.ts to import and call at startup.
 *
 * Uses INSERT OR IGNORE for idempotency — re-running after the initial
 * seed is a true no-op (no rows changed, no errors). The UNIQUE constraint
 * on `name` ensures existing rows are left untouched, so Phase 4's
 * type-recolor feature won't be clobbered by a server restart (T-3-02).
 */
import { type Database as DatabaseType } from 'better-sqlite3'
import { sqlite as defaultSqlite } from './db.js'

const SEED_TYPES = [
  { name: 'Filing',                 color: '#1D4ED8' },
  { name: 'Hearing',                color: '#B91C1C' },
  { name: 'Deposition',             color: '#C2410C' },
  { name: 'Statute of Limitations', color: '#7C3AED' },
  { name: 'Response/Opposition',    color: '#15803D' },
  { name: 'Status Conference',      color: '#0F766E' },
  { name: 'Discovery Cutoff',       color: '#B45309' },
  { name: 'Trial',                  color: '#9F1239' },
  { name: 'Other',                  color: '#374151' },
] as const

export function seedDeadlineTypes(db: DatabaseType = defaultSqlite): void {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO deadline_types (name, color) VALUES (?, ?)'
  )
  const insertMany = db.transaction((types: typeof SEED_TYPES) => {
    for (const t of types) insert.run(t.name, t.color)
  })
  insertMany(SEED_TYPES)
}
