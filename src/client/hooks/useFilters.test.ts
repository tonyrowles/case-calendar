// @vitest-environment jsdom
// Wave 2 — converted from it.todo stubs to live it() tests.
//
// Requirements: FILT-04 (URL as single source of truth for filter state)
// Security: URL injection — ?type=abc clamped; ?range=garbage falls back to this-week
import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { useFilters } from './useFilters.js'

function makeWrapper(initialEntry: string) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(
      MemoryRouter,
      { initialEntries: [initialEntry] },
      children
    )
  }
}

describe('useFilters — Wave 0 stubs (FILT-04)', () => {
  it('U1: reads URL params → returns typed Filters object (case, typeIds, range)', () => {
    const { result } = renderHook(() => useFilters(), {
      wrapper: makeWrapper('/?case=Smith&type=1,3&range=overdue'),
    })
    expect(result.current.filters.case).toBe('Smith')
    expect(result.current.filters.typeIds).toEqual([1, 3])
    expect(result.current.filters.range).toBe('overdue')
    expect(result.current.isDefault).toBe(false)
  })

  it('U2: setter merges — calling setCase with a value merges into existing URL params', () => {
    const { result } = renderHook(() => useFilters(), {
      wrapper: makeWrapper('/?range=overdue'),
    })
    act(() => {
      result.current.setCase('Bob')
    })
    // After setCase, range=overdue is still present and case=Bob added
    expect(result.current.filters.case).toBe('Bob')
    expect(result.current.filters.range).toBe('overdue')
  })

  it('U3: default-elision — range=this-week removes ?range= from URL (bare URL = default state)', () => {
    const { result } = renderHook(() => useFilters(), {
      wrapper: makeWrapper('/?range=overdue'),
    })
    act(() => {
      result.current.setRange('this-week')
    })
    // After setting range to default, isDefault should be true if no other filters
    expect(result.current.filters.range).toBe('this-week')
    expect(result.current.isDefault).toBe(true)
  })

  it('U4: clearAll — calling clearAll navigates to bare URL (no query params)', () => {
    const { result } = renderHook(() => useFilters(), {
      wrapper: makeWrapper('/?case=Smith&type=1,3&range=overdue'),
    })
    act(() => {
      result.current.clearAll()
    })
    expect(result.current.filters.case).toBeNull()
    expect(result.current.filters.typeIds).toEqual([])
    expect(result.current.filters.range).toBe('this-week')
    expect(result.current.isDefault).toBe(true)
  })

  it('U5: URL injection: ?type=abc,1,-1,0,2,3.5 clamped — only valid positive integers kept', () => {
    const { result } = renderHook(() => useFilters(), {
      wrapper: makeWrapper('/?type=abc,1,-1,0,2,3.5'),
    })
    // 'abc' → NaN, -1 → negative, 0 → zero, 3.5 → non-integer; only 1 and 2 survive
    expect(result.current.filters.typeIds).toEqual([1, 2])
  })

  it('U6: URL injection: ?range=garbage falls back to this-week range', () => {
    const { result } = renderHook(() => useFilters(), {
      wrapper: makeWrapper('/?range=garbage'),
    })
    expect(result.current.filters.range).toBe('this-week')
  })
})
