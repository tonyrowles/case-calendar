import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCaseColors, getDeadlines } from '@/client/lib/api.js'
import { assignCaseColors, caseColor, caseColorKey } from '@/shared/lib/case-colors.js'

/**
 * Case -> color for the whole client (list, filters, case picker, settings, wallpaper).
 * User-chosen colors (Settings > Cases) win; every other case gets an automatic color
 * assigned across the cases of all open (not completed) deadlines, skipping chosen
 * colors, so every view that uses this hook agrees on each case's color. Cases with
 * only completed deadlines fall back to their chosen or preferred (hash) color.
 *
 * If case colors can't be loaded (e.g. the case_colors table isn't there yet), the
 * automatic colors are used: a color lookup never breaks the page.
 */
export function useCaseColors(): (caseLabel: string) => string {
  const deadlinesQuery = useQuery({ queryKey: ['deadlines'], queryFn: getDeadlines })
  const overridesQuery = useQuery({ queryKey: ['case-colors'], queryFn: getCaseColors, retry: false })
  const overrides = overridesQuery.data

  const colors = useMemo(
    () => assignCaseColors(
      (deadlinesQuery.data ?? []).filter(d => d.completedAt === null).map(d => d.caseLabel),
      overrides ?? [],
    ),
    [deadlinesQuery.data, overrides]
  )
  const pinned = useMemo(
    () => new Map((overrides ?? []).map(o => [caseColorKey(o.caseLabel), o.color])),
    [overrides]
  )

  return useCallback(
    (caseLabel: string) => colors.get(caseLabel) ?? pinned.get(caseColorKey(caseLabel)) ?? caseColor(caseLabel),
    [colors, pinned]
  )
}
