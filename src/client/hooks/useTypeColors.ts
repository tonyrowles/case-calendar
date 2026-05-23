import { useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getDeadlineTypes } from '@/client/lib/api.js'

const FALLBACK_COLOR = '#374151' // gray-700 — "Other" type fallback

export const DEADLINE_TYPES_QUERY_KEY = ['deadline-types'] as const

export interface UseTypeColorsResult {
  colors: Map<number, string>
  getColor: (typeId: number) => string
  isLoading: boolean
  isError: boolean
}

export function useTypeColors(): UseTypeColorsResult {
  const query = useQuery({
    queryKey: DEADLINE_TYPES_QUERY_KEY,
    queryFn: getDeadlineTypes,
  })

  const colors = useMemo(() => {
    const map = new Map<number, string>()
    for (const t of query.data ?? []) {
      map.set(t.id, t.color)
    }
    return map
  }, [query.data])

  const warned = useRef(new Set<number>())

  function getColor(typeId: number): string {
    const color = colors.get(typeId)
    if (!color) {
      if (!warned.current.has(typeId)) {
        console.warn(`useTypeColors: typeId ${typeId} not in map, using fallback`)
        warned.current.add(typeId)
      }
      return FALLBACK_COLOR
    }
    return color
  }

  return {
    colors,
    getColor,
    isLoading: query.isLoading,
    isError: query.isError,
  }
}
