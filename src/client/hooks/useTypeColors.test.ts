// @vitest-environment jsdom
// Note: jsdom required for renderHook (Test 6 mounts the hook in a QueryClient wrapper).
// Wave 0 stub had no jsdom directive; added per plan deviation rules (documented in SUMMARY).
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import React from 'react'
import { DEADLINE_TYPES_QUERY_KEY, useTypeColors } from './useTypeColors.js'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('useTypeColors query key (HOOK-05)', () => {
  it('exports DEADLINE_TYPES_QUERY_KEY equal to [\'deadline-types\']', () => {
    expect(DEADLINE_TYPES_QUERY_KEY).toEqual(['deadline-types'])
  })

  it('matches the query key used in DeadlineForm and DeadlinesTable', () => {
    const root = resolve(__dirname, '../../..')
    const formSrc = readFileSync(resolve(root, 'src/client/components/DeadlineForm.tsx'), 'utf8')
    const tableSrc = readFileSync(resolve(root, 'src/client/components/DeadlinesTable.tsx'), 'utf8')
    expect(formSrc).toContain('deadline-types')
    expect(tableSrc).toContain('deadline-types')
  })
})

describe('useTypeColors fallback behavior', () => {
  function makeWrapper(queryClient: QueryClient) {
    return function Wrapper({ children }: { children: React.ReactNode }) {
      return React.createElement(QueryClientProvider, { client: queryClient }, children)
    }
  }

  it('getColor(unknownId) returns \'#374151\' fallback', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    queryClient.setQueryData(['deadline-types'], [])

    const { result } = renderHook(() => useTypeColors(), {
      wrapper: makeWrapper(queryClient),
    })

    expect(result.current.getColor(999)).toBe('#374151')
  })

  it('getColor(unknownId) emits exactly one console.warn for each unique unknownId', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    queryClient.setQueryData(['deadline-types'], [])

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { result } = renderHook(() => useTypeColors(), {
      wrapper: makeWrapper(queryClient),
    })

    // Call twice with same unknown id — should only warn once
    result.current.getColor(42)
    result.current.getColor(42)
    expect(warnSpy).toHaveBeenCalledTimes(1)
  })

  it('getColor(unknownId) emits a second console.warn for a different unknownId', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    queryClient.setQueryData(['deadline-types'], [])

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const { result } = renderHook(() => useTypeColors(), {
      wrapper: makeWrapper(queryClient),
    })

    // Different unknownIds each trigger their own first warn
    result.current.getColor(42)
    result.current.getColor(43)
    expect(warnSpy).toHaveBeenCalledTimes(2)
  })

  it('getColor(knownId) returns the hex from the loaded types map', () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    queryClient.setQueryData(['deadline-types'], [
      { id: 1, name: 'Filing', color: '#1D4ED8', createdAt: '2026-01-01T00:00:00Z' },
    ])

    const { result } = renderHook(() => useTypeColors(), {
      wrapper: makeWrapper(queryClient),
    })

    expect(result.current.getColor(1)).toBe('#1D4ED8')
  })
})
