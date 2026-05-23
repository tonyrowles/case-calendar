// SAFE-03: All date construction uses parseLocalDate (local-noon Date) — never new Date(isoString).
// For range='this-month' boundary math we use parseLocalDate + toISODateString only.
import { parseLocalDate, toISODateString } from './date.js'
import { weekBoundaries } from './buckets.js'

export type DateRange = 'overdue' | 'today' | 'this-week' | 'this-month' | 'all'

export interface Filters {
  case: string | null
  typeIds: number[]
  range: DateRange
}

/**
 * Compute the ISO date string for the last day of the month containing todayStr.
 * Uses parseLocalDate at local noon to dodge DST off-by-one bugs.
 *
 * Algorithm: advance to the first day of the next month, then subtract one day.
 * This works correctly for all months including February in leap years.
 */
function lastDayOfMonth(todayStr: string): string {
  // Extract year and month from todayStr directly (safe — no Date parsing of full string)
  const year = Number(todayStr.slice(0, 4))
  const month = Number(todayStr.slice(5, 7))  // 1-based

  // First of the next month (YYYY-MM-01)
  const nextMonthYear = month === 12 ? year + 1 : year
  const nextMonthNum = month === 12 ? 1 : month + 1
  const firstOfNextMonth = `${String(nextMonthYear).padStart(4, '0')}-${String(nextMonthNum).padStart(2, '0')}-01`

  // Subtract one day to get last day of current month
  const d = parseLocalDate(firstOfNextMonth)
  if (!d) throw new Error(`Invalid derived date: ${firstOfNextMonth}`)
  d.setDate(d.getDate() - 1)
  return toISODateString(d)
}

/**
 * Pure filter pipeline for deadline lists.
 *
 * Intersection semantics (AND): all active predicates must match.
 * - filters.case null/empty → no case constraint
 * - filters.typeIds empty → no type constraint
 * - filters.range 'all' → no date constraint (still excludes completedAt !== null)
 *
 * todayStr is INJECTED — this function never reads the system clock.
 * That makes it trivially testable across DST boundaries by parameterizing todayStr.
 *
 * Phase 3 always hides completed deadlines (completedAt !== null) — this is forward-compat
 * with Phase 4's CRUD-05/06 complete-toggle (RESEARCH Common Pitfall #4).
 */
export function applyFilters<
  T extends { date: string; caseLabel: string; typeId: number; completedAt: string | null }
>(deadlines: T[], filters: Filters, todayStr: string): T[] {
  return deadlines.filter(d => {
    // Always hide completed deadlines in Phase 3
    if (d.completedAt !== null) return false

    // Case filter: exact string match (FILT-01 — single value, not substring)
    if (filters.case !== null && d.caseLabel !== filters.case) return false

    // Type filter: inclusion in selected set (FILT-02 — empty = no constraint)
    if (filters.typeIds.length > 0 && !filters.typeIds.includes(d.typeId)) return false

    // Date range filter (FILT-03)
    switch (filters.range) {
      case 'overdue':
        if (!(d.date < todayStr)) return false
        break
      case 'today':
        if (d.date !== todayStr) return false
        break
      case 'this-week': {
        const { thisWeekStart, thisWeekEnd } = weekBoundaries(todayStr)
        if (d.date < thisWeekStart || d.date > thisWeekEnd) return false
        break
      }
      case 'this-month': {
        const monthStart = `${todayStr.slice(0, 7)}-01`  // YYYY-MM-01
        const monthEnd = lastDayOfMonth(todayStr)
        if (d.date < monthStart || d.date > monthEnd) return false
        break
      }
      case 'all':
        // No date constraint — passthrough
        break
    }

    return true
  })
}
