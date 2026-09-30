import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDeadlines } from '@/client/lib/api.js'
import { assignCaseColors, caseColor } from '@/shared/lib/case-colors.js'

/**
 * Case -> color for the whole client (list, filters, case picker, wallpaper). Colors are
 * assigned across the cases of all open (not completed) deadlines, so every view that uses
 * this hook agrees on each case's color. Cases with only completed deadlines fall back to
 * their preferred (hash) color.
 */
export function useCaseColors(): (caseLabel: string) => string {
  const deadlinesQuery = useQuery({ queryKey: ['deadlines'], queryFn: getDeadlines })
  const colors = useMemo(
    () => assignCaseColors((deadlinesQuery.data ?? []).filter(d => d.completedAt === null).map(d => d.caseLabel)),
    [deadlinesQuery.data]
  )
  return useCallback((caseLabel: string) => colors.get(caseLabel) ?? caseColor(caseLabel), [colors])
}
