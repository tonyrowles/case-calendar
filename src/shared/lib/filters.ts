// SAFE-03: All date construction uses parseLocalDate (local-noon Date) — never new Date(isoString).
// For range='this-month' boundary math we use parseLocalDate + toISODateString only.
import { parseLocalDate, toISODateString } from './date.js'
import { weekBoundaries } from './buckets.js'

/**
 * The list is a deadline view, not a task list: it starts at today. 'all' = today onward
 * (shown as "Upcoming"); 'past' = before today, for finding or fixing old entries.
 */
export type DateRange = 'past' | 'today' | 'this-week' | 'this-month' | 'all'

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
 * - filters.range: 'past' → before today; every other range starts at today
 *   ('all' = today onward, 'this-week' = today..Saturday, 'this-month' = today..month end)
 *
 * todayStr is INJECTED — this function never reads the system clock.
 * That makes it trivially testable across DST boundaries by parameterizing todayStr.
 */
export function applyFilters<
  T extends { date: string; caseLabel: string; typeId: number }
>(deadlines: T[], filters: Filters, todayStr: string): T[] {
  return deadlines.filter(d => {
    // Past deadlines appear only in the Past view
    if (filters.range === 'past') {
      if (!(d.date < todayStr)) return false
    } else if (d.date < todayStr) {
      return false
    }

    // Case filter: exact string match (FILT-01 — single value, not substring)
    if (filters.case !== null && d.caseLabel !== filters.case) return false

    // Type filter: inclusion in selected set (FILT-02 — empty = no constraint)
    if (filters.typeIds.length > 0 && !filters.typeIds.includes(d.typeId)) return false

    // Date range filter (FILT-03)
    switch (filters.range) {
      case 'past':
        break
      case 'today':
        if (d.date !== todayStr) return false
        break
      case 'this-week': {
        const { thisWeekEnd } = weekBoundaries(todayStr)
        if (d.date > thisWeekEnd) return false
        break
      }
      case 'this-month': {
        if (d.date > lastDayOfMonth(todayStr)) return false
        break
      }
      case 'all':
        // No date constraint — passthrough
        break
    }

    return true
  })
}
