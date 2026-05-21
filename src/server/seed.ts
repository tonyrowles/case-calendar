/**
 * Seed stub — Plan 01-03 replaces this with the full implementation.
 * This stub exists so Plan 01-02's index.ts import resolves during tests
 * before Plan 01-03 commits the real seed.
 *
 * The full implementation inserts 9 deadline types (Filing, Hearing, etc.)
 * using INSERT OR IGNORE for idempotency.
 */
import { sqlite } from './db.js'

const SEED_TYPES = [
  { name: 'Filing', color: '#1D4ED8' },
  { name: 'Hearing', color: '#B91C1C' },
  { name: 'Deposition', color: '#C2410C' },
  { name: 'Statute of Limitations', color: '#7C3AED' },
  { name: 'Response/Opposition', color: '#15803D' },
  { name: 'Status Conference', color: '#0F766E' },
  { name: 'Discovery Cutoff', color: '#B45309' },
  { name: 'Trial', color: '#9F1239' },
  { name: 'Other', color: '#374151' },
] as const

export function seedDeadlineTypes(): void {
  const insert = sqlite.prepare(
    'INSERT OR IGNORE INTO deadline_types (name, color) VALUES (?, ?)'
  )
  const insertMany = sqlite.transaction((types: typeof SEED_TYPES) => {
    for (const t of types) insert.run(t.name, t.color)
  })
  insertMany(SEED_TYPES)
}
