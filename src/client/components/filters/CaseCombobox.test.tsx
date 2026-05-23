// @vitest-environment jsdom
// Wave 2 — converted from it.todo stubs to live it() tests.
//
// Requirements: FILT-01 (case filter — single value combobox using shadcn Command inside Popover)
// Source: useQuery(['case-labels']) against GET /api/case-labels
import React from 'react'
import { describe, it, expect, vi, afterEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { CaseCombobox } from './CaseCombobox.js'

// cmdk (shadcn Command) uses ResizeObserver + scrollIntoView internally — polyfill for jsdom
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

/** Renders CaseCombobox with a controlled MemoryRouter and QueryClient.
 * The LocationCapture component stores the current URL location for assertions.
 */
function renderCombobox(
  initialEntry: string,
  cacheLabels?: string[]
): { locationRef: React.MutableRefObject<string>; container: HTMLElement } {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  if (cacheLabels !== undefined) {
    queryClient.setQueryData(['case-labels'], cacheLabels)
  }

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
        <CaseCombobox />
      </QueryClientProvider>
    </MemoryRouter>
  )

  return { locationRef, container }
}

describe('CaseCombobox — Wave 0 stubs (FILT-01)', () => {
  it('CC1: trigger label shows "Case" when no case is selected', () => {
    renderCombobox('/')
    const trigger = screen.getByRole('combobox', { name: /filter by case/i })
    // Trigger button text should contain 'Case'
    expect(trigger.textContent).toContain('Case')
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
  })

  it('CC2: selecting a case label writes ?case=<label> to URL (URL-encoded)', async () => {
    const { locationRef } = renderCombobox('/', ['Smith v. Jones'])

    // Click the trigger button to open the popover
    const trigger = screen.getByRole('combobox', { name: /filter by case/i })
    fireEvent.click(trigger)

    // Find and click the CommandItem (role="option") for 'Smith v. Jones'
    await waitFor(() => {
      const option = screen.getByRole('option', { name: /Smith v. Jones/i })
      expect(option).toBeDefined()
    })
    fireEvent.click(screen.getByRole('option', { name: /Smith v. Jones/i }))

    // The URL should now contain ?case=Smith%20v.%20Jones (or the decoded form used by MemoryRouter)
    await waitFor(() => {
      expect(locationRef.current).toContain('case=')
      expect(locationRef.current).toContain('Smith')
    })
  })

  it('CC3: selecting the already-selected label removes ?case= from URL (deselect toggle)', async () => {
    const { locationRef } = renderCombobox('/?case=Smith', ['Smith'])

    // Open the popover
    const trigger = screen.getByRole('combobox', { name: /filter by case/i })
    fireEvent.click(trigger)

    // Find the CommandItem (role="option" in cmdk) and click it to deselect
    await waitFor(() => {
      // CommandItem renders with role="option" in the list
      const option = screen.getByRole('option', { name: /Smith/i })
      expect(option).toBeDefined()
    })
    fireEvent.click(screen.getByRole('option', { name: /Smith/i }))

    // The URL should no longer contain ?case=
    await waitFor(() => {
      expect(locationRef.current).not.toContain('case=')
    })
  })

  it('CC4: trigger element has max-w-[180px] and truncate classes', () => {
    renderCombobox('/?case=A really very long case name that exceeds 180px')
    const trigger = screen.getByRole('combobox', { name: /filter by case/i })
    expect(trigger.className).toContain('max-w-[180px]')
    expect(trigger.className).toContain('truncate')
  })
})
