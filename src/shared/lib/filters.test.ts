// Wave 0 stub — applyFilters pure pipeline
// Plan 03-02 (Wave 1) converts these it.todo stubs to live it() tests.
//
// Requirements: FILT-01 (case filter), FILT-02 (type filter), FILT-03 (date range)
// Security: URL injection — type IDs clamped to valid values; range=garbage falls back
// All math uses lexicographic ISO string comparison — no new Date(string) (SAFE-03).
import { describe, it } from 'vitest'

describe('applyFilters — Wave 0 stubs (FILT-01, FILT-02, FILT-03)', () => {
  it.todo('F1: case predicate — filters to deadlines whose caseLabel matches the filter case exactly')
  it.todo('F2: type intersection — deadlines whose typeId is in the selected type IDs set are kept; others excluded')
  it.todo('F3: range=overdue — returns deadlines with date < todayStr AND completedAt===null')
  it.todo('F4: range=today — returns deadlines with date === todayStr AND completedAt===null')
  it.todo('F5: range=this-week — returns deadlines within Sunday-Saturday window')
  it.todo('F6: range=this-month — returns deadlines within calendar month of todayStr')
  it.todo('F7: range=all — passthrough, all deadlines returned regardless of date (excluding completed)')
  it.todo('F8: case AND type AND range intersection — all three filters applied together (AND semantics)')
  it.todo('F9: invalid type ids clamped — non-numeric or out-of-range type IDs from URL are ignored/removed')
})
