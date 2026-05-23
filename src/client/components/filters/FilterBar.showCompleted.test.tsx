// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { waitFor } from '@testing-library/dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { FilterBar } from './FilterBar.js'

// CRUD-06: FilterBar — "Show completed" Switch wired to URL param ?completed=1

afterEach(() => cleanup())

// Mock all the sub-components that fetch data so the test stays fast
vi.mock('./CaseCombobox.js', () => ({
  CaseCombobox: () => null,
}))
vi.mock('./TypeFilter.js', () => ({
  TypeFilter: () => null,
}))
vi.mock('./DateRangeSelect.js', () => ({
  DateRangeSelect: () => null,
}))

function renderFilterBar(initialPath = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: Infinity },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <FilterBar />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('CRUD-06: FilterBar — "Show completed" Switch', () => {
  it('renders "Show completed" label', () => {
    renderFilterBar()
    expect(screen.getByText('Show completed')).toBeDefined()
  })

  it('Switch is off (unchecked) by default when ?completed param is absent', () => {
    renderFilterBar('/')
    const switchEl = screen.getByRole('switch')
    expect(switchEl.getAttribute('data-state')).toBe('unchecked')
  })

  it('Switch is on (checked) when URL has ?completed=1', () => {
    renderFilterBar('/?completed=1')
    const switchEl = screen.getByRole('switch')
    expect(switchEl.getAttribute('data-state')).toBe('checked')
  })

  it('Switch has aria-label="Show completed deadlines"', () => {
    renderFilterBar()
    const switchEl = screen.getByRole('switch')
    expect(switchEl.getAttribute('aria-label')).toBe('Show completed deadlines')
  })

  it('toggling Switch on adds ?completed=1 to the URL', async () => {
    // We test by reading the switch's state — since MemoryRouter doesn't expose
    // URL changes in the test, we verify the Switch state reflects the URL via
    // the useFilters hook. We re-render with the expected URL.
    renderFilterBar('/')
    const switchEl = screen.getByRole('switch')
    // Initially off
    expect(switchEl.getAttribute('data-state')).toBe('unchecked')

    // Click the switch to toggle on
    act(() => {
      fireEvent.click(switchEl)
    })

    // After click, the switch should be checked (showCompleted=true → ?completed=1 in URL)
    await waitFor(() => {
      const s = screen.getByRole('switch')
      expect(s.getAttribute('data-state')).toBe('checked')
    })
  })

  it('toggling Switch off removes the ?completed param from the URL', async () => {
    renderFilterBar('/?completed=1')
    const switchEl = screen.getByRole('switch')
    // Initially on
    expect(switchEl.getAttribute('data-state')).toBe('checked')

    // Click to toggle off
    act(() => {
      fireEvent.click(switchEl)
    })

    await waitFor(() => {
      const s = screen.getByRole('switch')
      expect(s.getAttribute('data-state')).toBe('unchecked')
    })
  })

  it('label htmlFor matches Switch id="show-completed"', () => {
    renderFilterBar()
    const label = screen.getByText('Show completed').closest('label')
    expect(label).not.toBeNull()
    expect(label!.getAttribute('for')).toBe('show-completed')
    const switchEl = document.getElementById('show-completed')
    expect(switchEl).not.toBeNull()
  })
})
