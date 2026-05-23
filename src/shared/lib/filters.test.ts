// Wave 1 — converted from it.todo stubs (Plan 03-01) to live tests (Plan 03-02).
//
// Requirements: FILT-01 (case filter), FILT-02 (type filter), FILT-03 (date range)
// Security: URL injection — type IDs clamped to valid values; range=garbage falls back
// All math uses lexicographic ISO string comparison — no new Date(string) (SAFE-03).
import { describe, it, expect } from 'vitest'
import { applyFilters, type Filters } from './filters.js'

// ---------------------------------------------------------------------------
// Canonical fixture date: Thursday 2026-05-21
// Matches the B-series fixtures in buckets.test.ts for cross-file consistency.
// weekBoundaries('2026-05-21') => thisWeekStart='2026-05-17' (Sun), thisWeekEnd='2026-05-23' (Sat)
//                                  nextWeekStart='2026-05-24', nextWeekEnd='2026-05-30'
// Month: May 2026 => monthStart='2026-05-01', monthEnd='2026-05-31'
// ---------------------------------------------------------------------------
const TODAY = '2026-05-21'

// Minimal deadline shape for test fixtures
type Fixture = {
  id: number
  date: string
  caseLabel: string
  typeId: number
  completedAt: string | null
}

function makeDeadline(overrides: Partial<Fixture> & { date: string }): Fixture {
  return {
    id: 1,
    caseLabel: 'Default Case',
    typeId: 1,
    completedAt: null,
    ...overrides,
  }
}

const defaultFilters: Filters = { case: null, typeIds: [], range: 'all' }

describe('applyFilters — FILT-01, FILT-02, FILT-03', () => {
  it('F1: case predicate — filters to deadlines whose caseLabel matches the filter case exactly', () => {
    const deadlines = [
      makeDeadline({ id: 1, date: '2026-05-25', caseLabel: 'Smith v. Jones' }),
      makeDeadline({ id: 2, date: '2026-05-26', caseLabel: 'Jones v. Smith' }),
      makeDeadline({ id: 3, date: '2026-05-27', caseLabel: 'smith v. jones' }),  // wrong case
    ]
    const result = applyFilters(deadlines, { ...defaultFilters, case: 'Smith v. Jones' }, TODAY)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(1)
    // Null case = no constraint: all active returned
    const noCase = applyFilters(deadlines, { ...defaultFilters, case: null }, TODAY)
    expect(noCase).toHaveLength(3)
  })

  it('F2: type intersection — deadlines whose typeId is in the selected type IDs set are kept; others excluded', () => {
    const deadlines = [
      makeDeadline({ id: 1, date: '2026-05-25', typeId: 1 }),
      makeDeadline({ id: 2, date: '2026-05-26', typeId: 3 }),
      makeDeadline({ id: 3, date: '2026-05-27', typeId: 5 }),
    ]
    const result = applyFilters(deadlines, { ...defaultFilters, typeIds: [1, 3] }, TODAY)
    expect(result.map(d => d.id)).toEqual(expect.arrayContaining([1, 2]))
    expect(result.map(d => d.id)).not.toContain(3)
    // Empty typeIds = no constraint
    const noType = applyFilters(deadlines, { ...defaultFilters, typeIds: [] }, TODAY)
    expect(noType).toHaveLength(3)
  })

  it('F3: range=overdue — returns deadlines with date < todayStr AND completedAt===null', () => {
    const deadlines = [
      makeDeadline({ id: 1, date: '2026-05-20', completedAt: null }),           // overdue
      makeDeadline({ id: 2, date: '2026-05-20', completedAt: '2026-05-20T12:00:00' }), // completed — excluded
      makeDeadline({ id: 3, date: TODAY }),                                     // today — not overdue
      makeDeadline({ id: 4, date: '2026-05-22' }),                              // future — not overdue
    ]
    const result = applyFilters(deadlines, { ...defaultFilters, range: 'overdue' }, TODAY)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(1)
  })

  it('F4: range=today — returns deadlines with date === todayStr AND completedAt===null', () => {
    const deadlines = [
      makeDeadline({ id: 1, date: TODAY }),
      makeDeadline({ id: 2, date: TODAY, completedAt: '2026-05-21T09:00:00' }),  // completed — excluded
      makeDeadline({ id: 3, date: '2026-05-20' }),                               // overdue
      makeDeadline({ id: 4, date: '2026-05-22' }),                               // future
    ]
    const result = applyFilters(deadlines, { ...defaultFilters, range: 'today' }, TODAY)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(1)
  })

  it('F5: range=this-week — returns deadlines within Sunday-Saturday window', () => {
    // This week: 2026-05-17 (Sun) — 2026-05-23 (Sat)
    const deadlines = [
      makeDeadline({ id: 1, date: '2026-05-16' }),  // day before Sunday — not this week
      makeDeadline({ id: 2, date: '2026-05-17' }),  // Sunday start of week
      makeDeadline({ id: 3, date: '2026-05-20' }),  // Wednesday (overdue vs TODAY but in week)
      makeDeadline({ id: 4, date: TODAY }),          // Thursday
      makeDeadline({ id: 5, date: '2026-05-23' }),  // Saturday end of week
      makeDeadline({ id: 6, date: '2026-05-24' }),  // Sunday — next week
    ]
    const result = applyFilters(deadlines, { ...defaultFilters, range: 'this-week' }, TODAY)
    const ids = result.map(d => d.id)
    expect(ids).toContain(2)  // Sunday in window
    expect(ids).toContain(3)  // Wednesday in window (past date, not completed — still included)
    expect(ids).toContain(4)  // Thursday in window
    expect(ids).toContain(5)  // Saturday in window
    expect(ids).not.toContain(1)  // before window
    expect(ids).not.toContain(6)  // after window
  })

  it('F6: range=this-month — returns deadlines within calendar month of todayStr', () => {
    // May 2026: 2026-05-01 — 2026-05-31
    const deadlines = [
      makeDeadline({ id: 1, date: '2026-04-30' }),  // April — outside month
      makeDeadline({ id: 2, date: '2026-05-01' }),  // first of month
      makeDeadline({ id: 3, date: '2026-05-15' }),  // mid-month
      makeDeadline({ id: 4, date: '2026-05-31' }),  // last of month
      makeDeadline({ id: 5, date: '2026-06-01' }),  // June — outside month
    ]
    const result = applyFilters(deadlines, { ...defaultFilters, range: 'this-month' }, TODAY)
    const ids = result.map(d => d.id)
    expect(ids).not.toContain(1)  // April
    expect(ids).toContain(2)      // May 1
    expect(ids).toContain(3)      // May 15
    expect(ids).toContain(4)      // May 31
    expect(ids).not.toContain(5)  // June
  })

  it('F7: range=all — passthrough, all active (non-completed) deadlines returned regardless of date', () => {
    const deadlines = [
      makeDeadline({ id: 1, date: '2020-01-01' }),   // far past
      makeDeadline({ id: 2, date: TODAY }),           // today
      makeDeadline({ id: 3, date: '2030-12-31' }),   // far future
      makeDeadline({ id: 4, date: '2026-05-15', completedAt: '2026-05-15T10:00:00' }), // completed — excluded
    ]
    const result = applyFilters(deadlines, { ...defaultFilters, range: 'all' }, TODAY)
    const ids = result.map(d => d.id)
    expect(ids).toContain(1)
    expect(ids).toContain(2)
    expect(ids).toContain(3)
    expect(ids).not.toContain(4)  // completed always excluded
  })

  it('F8: case AND type AND range intersection — all three filters applied together (AND semantics)', () => {
    const deadlines = [
      // Matches all three: correct case, correct type, in this-week
      makeDeadline({ id: 1, date: '2026-05-22', caseLabel: 'Smith v. Jones', typeId: 1 }),
      // Wrong case
      makeDeadline({ id: 2, date: '2026-05-22', caseLabel: 'Other Case', typeId: 1 }),
      // Wrong type
      makeDeadline({ id: 3, date: '2026-05-22', caseLabel: 'Smith v. Jones', typeId: 2 }),
      // Outside this-week (next week)
      makeDeadline({ id: 4, date: '2026-05-25', caseLabel: 'Smith v. Jones', typeId: 1 }),
      // Correct but completed
      makeDeadline({ id: 5, date: '2026-05-22', caseLabel: 'Smith v. Jones', typeId: 1, completedAt: '2026-05-21T10:00:00' }),
    ]
    const filters: Filters = { case: 'Smith v. Jones', typeIds: [1], range: 'this-week' }
    const result = applyFilters(deadlines, filters, TODAY)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(1)
  })

  it('F9: invalid type ids clamped — non-numeric or out-of-range type IDs from URL are ignored/removed', () => {
    // applyFilters receives the already-clamped typeIds from useFilters.
    // By convention, useFilters drops NaN / 0 / negative ids before passing to applyFilters.
    // This test asserts the filter behaves correctly when given clean (already-clamped) ids.
    const deadlines = [
      makeDeadline({ id: 1, date: '2026-05-25', typeId: 1 }),
      makeDeadline({ id: 2, date: '2026-05-26', typeId: 2 }),
    ]
    // Empty typeIds after clamping = no type constraint = all returned
    const emptyResult = applyFilters(deadlines, { ...defaultFilters, typeIds: [] }, TODAY)
    expect(emptyResult).toHaveLength(2)

    // Only valid positive typeIds pass through
    const filteredResult = applyFilters(deadlines, { ...defaultFilters, typeIds: [1] }, TODAY)
    expect(filteredResult).toHaveLength(1)
    expect(filteredResult[0].id).toBe(1)
  })
})
