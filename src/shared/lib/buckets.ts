// SAFE-03: All date construction uses parseLocalDate (local-noon Date) — never new Date(isoString).
// See src/shared/lib/date.ts for the single permitted date-string-to-Date conversion.
import { parseLocalDate, toISODateString } from './date.js'

export type Bucket = 'overdue' | 'today' | 'thisWeek' | 'nextWeek' | 'later'

/**
 * Add `days` calendar days to an ISO date string.
 * Uses parseLocalDate (local-noon) to dodge DST off-by-one bugs.
 */
function addDaysIso(isoDate: string, days: number): string {
  const d = parseLocalDate(isoDate)
  if (!d) throw new Error(`Invalid ISO date: ${isoDate}`)
  d.setDate(d.getDate() + days)
  return toISODateString(d)
}

/**
 * Return the day-of-week (0=Sun, 6=Sat) for an ISO date string.
 * Uses parseLocalDate (local-noon) to dodge DST off-by-one bugs.
 */
function dayOfWeek(isoDate: string): number {
  const d = parseLocalDate(isoDate)
  if (!d) throw new Error(`Invalid ISO date: ${isoDate}`)
  return d.getDay()
}

/**
 * Compute Sunday-Saturday week boundaries for the current and next week.
 * Returns ISO date strings (YYYY-MM-DD).
 *
 * "This Week" = Sunday of the week containing todayStr through the following Saturday.
 * "Next Week" = the Sunday after that through its Saturday.
 * These boundaries match VIEW-02 Sunday week-start convention.
 */
export function weekBoundaries(todayStr: string): {
  thisWeekStart: string
  thisWeekEnd: string
  nextWeekStart: string
  nextWeekEnd: string
} {
  const dow = dayOfWeek(todayStr)           // 0 (Sun) … 6 (Sat)
  const thisWeekStart = addDaysIso(todayStr, -dow)      // Sunday of current week
  const thisWeekEnd = addDaysIso(thisWeekStart, 6)      // Saturday of current week
  const nextWeekStart = addDaysIso(thisWeekEnd, 1)      // Sunday of next week
  const nextWeekEnd = addDaysIso(nextWeekStart, 6)      // Saturday of next week
  return { thisWeekStart, thisWeekEnd, nextWeekStart, nextWeekEnd }
}

/**
 * Classify a deadline into one of the five display buckets.
 *
 * Rules (in priority order):
 * - overdue: date < todayStr AND completedAt === null
 * - today:   date === todayStr  (regardless of completedAt — groupByBucket filters upstream)
 * - thisWeek: date in (todayStr, thisWeekEnd] — strictly after today but within Saturday
 * - nextWeek: date in [nextWeekStart, nextWeekEnd]
 * - later:   everything else
 *
 * Completed deadlines are excluded by groupByBucket before calling classifyDeadline,
 * but direct callers may pass completed deadlines — they are NOT classified as 'overdue'
 * (that would be misleading), so they fall through to today/thisWeek/nextWeek/later
 * based purely on their date. This matches Phase 4 forward-compat (CRUD-05/06 toggle).
 */
export function classifyDeadline(
  d: { date: string; completedAt: string | null },
  todayStr: string
): Bucket {
  if (d.date < todayStr && d.completedAt === null) return 'overdue'
  if (d.date === todayStr) return 'today'
  const { thisWeekEnd, nextWeekEnd } = weekBoundaries(todayStr)
  if (d.date <= thisWeekEnd) return 'thisWeek'
  if (d.date <= nextWeekEnd) return 'nextWeek'
  return 'later'
}

/**
 * Group deadlines into the five buckets, excluding completed entries.
 *
 * Each bucket array is sorted chronologically ascending by date, with
 * createdAt as the deterministic tie-break for same-date deadlines.
 * (CONTEXT.md lock: `(a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)`)
 *
 * completedAt !== null deadlines are excluded entirely (forward-compat with Phase 4
 * CRUD-05/06 complete toggle — Phase 3 always hides completed).
 */
export function groupByBucket<
  T extends { date: string; completedAt: string | null; createdAt: string }
>(deadlines: T[], todayStr: string): Record<Bucket, T[]> {
  const groups: Record<Bucket, T[]> = {
    overdue: [],
    today: [],
    thisWeek: [],
    nextWeek: [],
    later: [],
  }

  for (const d of deadlines) {
    if (d.completedAt !== null) continue  // Phase 3 hides completed; Phase 4 will revisit
    groups[classifyDeadline(d, todayStr)].push(d)
  }

  // Sort each bucket: date ascending, createdAt as deterministic tie-break
  const buckets = Object.keys(groups) as Bucket[]
  for (const bucket of buckets) {
    groups[bucket].sort(
      (a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)
    )
  }

  return groups
}
