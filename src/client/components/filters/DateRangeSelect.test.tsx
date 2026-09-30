// @vitest-environment jsdom
// Wave 2 — converted from it.todo stubs to live it() tests.
//
// Requirements: FILT-03 (date range preset — 5 options: Overdue, Today, This Week, This Month, All)
// Default = all; selecting default removes ?range= (default-elision)
import React from 'react'
import { describe, it, expect, afterEach, beforeAll } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { DateRangeSelect } from './DateRangeSelect.js'

// Radix Select uses scrollIntoView and ResizeObserver — polyfill for jsdom
beforeAll(() => {
  if (typeof window !== 'undefined') {
    if (!window.ResizeObserver) {
      window.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    }
    // Polyfill scrollIntoView (not available in jsdom)
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = function () {}
    }
    // Polyfill Pointer Capture APIs — Radix UI Select uses these on pointerdown/up
    // cleanup; jsdom does not implement them and the missing functions surface as
    // unhandled async exceptions even though no assertion fails.
    if (!HTMLElement.prototype.hasPointerCapture) {
      HTMLElement.prototype.hasPointerCapture = function () { return false }
    }
    if (!HTMLElement.prototype.setPointerCapture) {
      HTMLElement.prototype.setPointerCapture = function () {}
    }
    if (!HTMLElement.prototype.releasePointerCapture) {
      HTMLElement.prototype.releasePointerCapture = function () {}
    }
  }
})

afterEach(() => cleanup())

function renderDateRangeSelect(initialEntry: string): {
  locationRef: React.MutableRefObject<string>
  container: HTMLElement
} {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })

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
        <DateRangeSelect />
      </QueryClientProvider>
    </MemoryRouter>
  )

  return { locationRef, container }
}

describe('DateRangeSelect — Wave 0 stubs (FILT-03)', () => {
  it('DRS1: default "All" preset is shown when ?range= is absent from URL', () => {
    renderDateRangeSelect('/')
    // The SelectTrigger should show 'All' as the selected option (via SelectValue)
    const trigger = screen.getByRole('combobox', { name: /date range filter/i })
    expect(trigger.textContent).toContain('All')
  })

  it('DRS2: selecting "overdue" preset writes ?range=overdue to URL', async () => {
    const { locationRef } = renderDateRangeSelect('/')

    // Open the select — Radix Select uses role="combobox" on the trigger
    const trigger = screen.getByRole('combobox', { name: /date range filter/i })
    fireEvent.click(trigger)
    fireEvent.pointerDown(trigger)

    // Radix renders the options in a portal to document.body
    await waitFor(() => {
      const overdue = screen.queryByText('Overdue')
      expect(overdue).not.toBeNull()
    })
    // Click the Overdue option
    fireEvent.click(screen.getByText('Overdue'))

    await waitFor(() => {
      expect(locationRef.current).toContain('range=overdue')
    })
  })

  it('DRS3: selecting "All" explicitly removes ?range= from URL (default-elision)', async () => {
    const { locationRef } = renderDateRangeSelect('/?range=overdue')

    const trigger = screen.getByRole('combobox', { name: /date range filter/i })
    fireEvent.click(trigger)
    fireEvent.pointerDown(trigger)

    // Wait for the dropdown to render
    await waitFor(() => {
      // The Select Content should render in portal — look for option text
      const options = screen.queryAllByText('All')
      expect(options.length).toBeGreaterThan(0)
    })

    // Get all 'All' text nodes — the option in the list (not the trigger value)
    const allOptions = screen.queryAllByText('All')
    // Click the one inside the SelectContent (last one to avoid the trigger value)
    fireEvent.click(allOptions[allOptions.length - 1])

    await waitFor(() => {
      expect(locationRef.current).not.toContain('range=')
    })
  })

  it('DRS4: all 5 preset options are present in the select menu (overdue, today, this-week, this-month, all)', async () => {
    renderDateRangeSelect('/')

    const trigger = screen.getByRole('combobox', { name: /date range filter/i })
    fireEvent.click(trigger)
    fireEvent.pointerDown(trigger)

    await waitFor(() => {
      expect(screen.queryByText('Overdue')).not.toBeNull()
      expect(screen.queryByText('Today')).not.toBeNull()
      expect(screen.queryByText('This Week')).not.toBeNull()
      expect(screen.queryByText('This Month')).not.toBeNull()
      // All appears in trigger + list
      expect(screen.queryAllByText('All').length).toBeGreaterThan(0)
    })
  })
})
