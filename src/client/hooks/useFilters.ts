import { useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'

export type DateRange = 'overdue' | 'today' | 'this-week' | 'this-month' | 'all'

export interface Filters {
  case: string | null   // ?case=Smith%20v.%20Jones
  typeIds: number[]     // ?type=1,3,7
  range: DateRange      // ?range=this-week (default: all, omitted from URL when at default)
  showCompleted: boolean // ?completed=1 (default: false; omitted from URL when false)
}

// Default is everything: the desktop wallpaper already shows the next few weeks at a glance
const DEFAULT_RANGE: DateRange = 'all'

const VALID_RANGES: readonly DateRange[] = ['overdue', 'today', 'this-week', 'this-month', 'all'] as const

function parseTypeIds(raw: string | null): number[] {
  if (!raw) return []
  return raw
    .split(',')
    .map(Number)
    .filter(n => Number.isInteger(n) && n > 0)
}

function parseRange(raw: string | null): DateRange {
  if (!raw) return DEFAULT_RANGE
  if ((VALID_RANGES as readonly string[]).includes(raw)) return raw as DateRange
  return DEFAULT_RANGE
}

export function useFilters(): {
  filters: Filters
  setCase: (v: string | null) => void
  setTypeIds: (ids: number[]) => void
  setRange: (r: DateRange) => void
  setShowCompleted: (v: boolean) => void
  clearAll: () => void
  isDefault: boolean
} {
  const [params, setParams] = useSearchParams()

  const filters: Filters = useMemo(() => ({
    case: params.get('case') || null,
    typeIds: parseTypeIds(params.get('type')),
    range: parseRange(params.get('range')),
    // T-04-03-01: strict '===' '1' comparison rejects null, '0', 'true', 'on', etc.
    showCompleted: params.get('completed') === '1',
  }), [params])

  const setCase = useCallback((v: string | null) => {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      if (!v) next.delete('case'); else next.set('case', v)
      return next
    })
  }, [setParams])

  const setTypeIds = useCallback((ids: number[]) => {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      if (ids.length === 0) next.delete('type'); else next.set('type', ids.join(','))
      return next
    })
  }, [setParams])

  const setRange = useCallback((r: DateRange) => {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      if (r === DEFAULT_RANGE) next.delete('range'); else next.set('range', r)
      return next
    })
  }, [setParams])

  const setShowCompleted = useCallback((v: boolean) => {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      // Default-elision: false removes param (not in URL by default)
      if (!v) next.delete('completed'); else next.set('completed', '1')
      return next
    })
  }, [setParams])

  const clearAll = useCallback(() => {
    setParams(new URLSearchParams())
  }, [setParams])

  const isDefault =
    filters.case === null &&
    filters.typeIds.length === 0 &&
    filters.range === DEFAULT_RANGE &&
    filters.showCompleted === false

  return { filters, setCase, setTypeIds, setRange, setShowCompleted, clearAll, isDefault }
}
