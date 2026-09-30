import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getCases } from '@/client/lib/api.js'
import { caseColorKey } from '@/shared/lib/case-colors.js'

/**
 * `isArchived(label)` for hiding closed cases from the case picker and case filter.
 * Archived cases' deadlines are never hidden. If cases can't be loaded, nothing counts
 * as archived (show everything rather than hide something by mistake).
 */
export function useArchivedCases(): (caseLabel: string) => boolean {
  const casesQuery = useQuery({ queryKey: ['cases'], queryFn: getCases, retry: false })
  const keys = useMemo(
    () => new Set((casesQuery.data ?? []).filter(c => c.archived).map(c => caseColorKey(c.caseLabel))),
    [casesQuery.data]
  )
  return useCallback((caseLabel: string) => keys.has(caseColorKey(caseLabel)), [keys])
}
