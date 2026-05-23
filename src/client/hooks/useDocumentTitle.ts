import { useEffect } from 'react'

/**
 * Writes document.title to 'Case Calendar (N due today)' when N > 0
 * or 'Case Calendar' when N = 0.
 *
 * Count is NOT filter-aware — always reflects all deadlines due today
 * regardless of what the user is currently filtering on (VIEW-08).
 *
 * todayStr must be a YYYY-MM-DD string derived from toISODateString(new Date())
 * (not new Date(isoString) — SAFE-03 invariant).
 */
export function useDocumentTitle(
  deadlines: Array<{ date: string; completedAt: string | null }> | undefined,
  todayStr: string
): void {
  useEffect(() => {
    if (deadlines === undefined) return
    const count = deadlines.filter(
      d => d.date === todayStr && d.completedAt === null
    ).length
    document.title = count > 0 ? `Case Calendar (${count} due today)` : 'Case Calendar'
  }, [deadlines, todayStr])
}
