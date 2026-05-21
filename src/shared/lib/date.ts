// SAFE-03: The ONLY place in the codebase where date strings become Date objects.
// All other code must import from here — never call new Date(isoString) directly.

/**
 * Parse a YYYY-MM-DD string to a Date at local noon.
 * Local noon avoids DST off-by-one errors (DST transitions are at 2 AM, not noon).
 * Returns null for invalid dates (e.g., 2026-02-30).
 */
export function parseLocalDate(isoString: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoString)
  if (!match) return null
  const [, y, m, d] = match.map(Number)
  const date = new Date(y, m - 1, d, 12, 0, 0)  // Local noon
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
    return null  // Invalid calendar date (e.g., Feb 30)
  }
  return date
}

/**
 * Format a Date to YYYY-MM-DD using local timezone.
 */
export function toISODateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
