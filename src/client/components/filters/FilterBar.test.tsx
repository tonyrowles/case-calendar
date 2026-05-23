// @vitest-environment jsdom
// Wave 2 — converted from it.todo stubs to live it() tests.
//
// Requirements: FILT-05 (Clear button conditional render)
// Clear appears ONLY when at least one filter is non-default; clicking restores bare URL
import React from 'react'
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { FilterBar } from './FilterBar.js'
import type { DeadlineType } from '@/shared/schemas/deadline.js'

// Polyfills required by child components (cmdk + Radix UI) in jsdom
beforeAll(() => {
  if (typeof window !== 'undefined') {
    if (!window.ResizeObserver) {
      window.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    }
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = function () {}
    }
  }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const mockTypes: DeadlineType[] = [
  { id: 1, name: 'Filing', color: '#1D4ED8', createdAt: '2026-01-01T00:00:00Z' },
]

function renderFilterBar(initialEntry: string): {
  locationRef: React.MutableRefObject<string>
  container: HTMLElement
} {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  // Pre-seed deadline-types cache for TypeFilter's useTypeColors
  queryClient.setQueryData(['deadline-types'], mockTypes)
  // Pre-seed case-labels cache for CaseCombobox
  queryClient.setQueryData(['case-labels'], [])

  const locationRef: React.MutableRefObject<string> = { current: initialEntry }

  function LocationCapture() {
    const loc = useLocation()
    locationRef.current = loc.pathname + loc.search
    return null
  }

  const { container } = render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <QueryClientProvider client={queryClient}>
        <LocationCapture />
        <FilterBar />
      </QueryClientProvider>
    </MemoryRouter>
  )

  return { locationRef, container }
}

describe('FilterBar — Wave 0 stubs (FILT-05)', () => {
  it('FB1: Clear button hidden when all filters are at defaults (bare URL / range=this-week only)', () => {
    const { container } = renderFilterBar('/')

    // Clear button should NOT be in the DOM when at default state
    const clearBtn = container.querySelector('[aria-label="Clear all filters"]')
    expect(clearBtn).toBeNull()
  })

  it('FB2: Clear button visible when any filter is active (case set, or types set, or non-default range)', () => {
    renderFilterBar('/?case=Smith')

    // Clear button SHOULD be in the DOM when any filter is non-default
    const clearBtn = screen.getByRole('button', { name: /clear all filters/i })
    expect(clearBtn).toBeDefined()
    expect(clearBtn.textContent).toContain('Clear')
  })

  it('FB3: clicking Clear navigates to bare URL (removes all query params)', async () => {
    const { locationRef } = renderFilterBar('/?case=Smith&type=1&range=overdue')

    // Clear button should be present
    const clearBtn = screen.getByRole('button', { name: /clear all filters/i })
    expect(clearBtn).toBeDefined()

    // Click Clear
    fireEvent.click(clearBtn)

    // URL should now be bare (no search params)
    await waitFor(() => {
      expect(locationRef.current).toBe('/')
    })
  })
})
