// @vitest-environment jsdom
// Wave 2 — converted from it.todo stubs to live it() tests.
//
// Requirements: FILT-02 (type multi-select filter using Popover + Checkbox list)
// Source: useTypeColors().types — no new API call
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { TypeFilter } from './TypeFilter.js'
import type { DeadlineType } from '@/shared/schemas/deadline.js'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const mockTypes: DeadlineType[] = [
  { id: 1, name: 'Filing', color: '#1D4ED8', createdAt: '2026-01-01T00:00:00Z' },
  { id: 2, name: 'Hearing', color: '#7C3AED', createdAt: '2026-01-01T00:00:00Z' },
  { id: 3, name: 'Deposition', color: '#DC2626', createdAt: '2026-01-01T00:00:00Z' },
]

function renderTypeFilter(initialEntry: string): {
  locationRef: React.MutableRefObject<string>
  container: HTMLElement
} {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  // Pre-populate the deadline-types cache (TypeFilter reads via useTypeColors)
  queryClient.setQueryData(['deadline-types'], mockTypes)

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
        <TypeFilter />
      </QueryClientProvider>
    </MemoryRouter>
  )

  return { locationRef, container }
}

describe('TypeFilter — Wave 0 stubs (FILT-02)', () => {
  it('TF1: trigger label shows "Types" when no types are selected, without bg-secondary', () => {
    renderTypeFilter('/')
    const trigger = screen.getByRole('button', { name: /filter by deadline type/i })
    expect(trigger.textContent).toContain('Types')
    // No 'Types (N)' text when N=0
    expect(trigger.textContent).not.toMatch(/Types \(\d+\)/)
    // No bg-secondary class when no types selected
    expect(trigger.className).not.toContain('bg-secondary')
  })

  it('TF2: trigger label shows "Types (N)" where N is the count of selected types', () => {
    renderTypeFilter('/?type=1,3')
    const trigger = screen.getByRole('button', { name: /filter by deadline type/i })
    expect(trigger.textContent).toContain('Types (2)')
    expect(trigger.className).toContain('bg-secondary')
  })

  it('TF3: checking a type checkbox writes ?type=<id> to URL', async () => {
    const { locationRef } = renderTypeFilter('/')

    // Open the popover
    const trigger = screen.getByRole('button', { name: /filter by deadline type/i })
    fireEvent.click(trigger)

    // Wait for type list to appear
    await waitFor(() => {
      expect(screen.getByText('Filing')).toBeDefined()
    })

    // Click the row for Filing (id=1)
    const filingRow = screen.getByText('Filing').closest('label')!
    fireEvent.click(filingRow)

    // URL should contain type=1
    await waitFor(() => {
      expect(locationRef.current).toContain('type=')
      expect(locationRef.current).toContain('1')
    })
  })

  it('TF4: type list is sourced from useTypeColors().types — no separate API call made', () => {
    // Spy on fetch to confirm TypeFilter does NOT trigger a fetch when deadline-types cache is seeded
    const fetchSpy = vi.spyOn(globalThis, 'fetch')

    renderTypeFilter('/')

    // No fetch should have been called for deadline-types (cache is seeded via setQueryData)
    expect(fetchSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('/api/deadline-types'),
      expect.anything()
    )
    // Note: fetch may still be called for case-labels by CaseCombobox if mounted,
    // but TypeFilter itself never calls fetch directly
  })
})
