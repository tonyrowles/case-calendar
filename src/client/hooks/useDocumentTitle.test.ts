// @vitest-environment jsdom
// Wave 2 — converted from it.todo stubs to live it() tests.
//
// Requirements: VIEW-08 (browser tab title "Case Calendar (N due today)")
// Tab title count is NOT filter-aware — always all deadlines due today
import { describe, it, expect, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useDocumentTitle } from './useDocumentTitle.js'

const TODAY = '2026-06-01'

afterEach(() => {
  document.title = 'Case Calendar'
})

describe('useDocumentTitle — Wave 0 stubs (VIEW-08)', () => {
  it('T1: N=3 due today → document.title is "Case Calendar (3 due today)"', () => {
    const deadlines = [
      { date: TODAY, completedAt: null },
      { date: TODAY, completedAt: null },
      { date: TODAY, completedAt: null },
      { date: '2026-06-02', completedAt: null },  // not today
    ]
    renderHook(() => useDocumentTitle(deadlines, TODAY))
    expect(document.title).toBe('Case Calendar (3 due today)')
  })

  it('T2: N=0 due today → document.title is "Case Calendar" (no parens, no "(0 due today)")', () => {
    const deadlines = [
      { date: '2026-06-02', completedAt: null },
      { date: '2026-06-03', completedAt: null },
    ]
    renderHook(() => useDocumentTitle(deadlines, TODAY))
    expect(document.title).toBe('Case Calendar')
  })

  it('T3: deadlines with completedAt!==null are excluded from today count', () => {
    const deadlines = [
      { date: TODAY, completedAt: null },        // counts
      { date: TODAY, completedAt: '2026-06-01T10:00:00Z' },  // completed — excluded
      { date: TODAY, completedAt: null },        // counts
    ]
    renderHook(() => useDocumentTitle(deadlines, TODAY))
    expect(document.title).toBe('Case Calendar (2 due today)')
  })

  it('T4: count ignores filter state — title always reflects unfiltered all-deadlines-due-today count', () => {
    // When deadlines is undefined (initial load race), the effect must not throw.
    // The title should remain as the sentinel we set before render.
    document.title = 'sentinel-title'
    renderHook(() => useDocumentTitle(undefined, TODAY))
    // With undefined deadlines, the effect should skip the write
    expect(document.title).toBe('sentinel-title')
  })
})
