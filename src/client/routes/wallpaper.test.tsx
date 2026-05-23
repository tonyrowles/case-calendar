// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WallpaperView } from './wallpaper.js'
import type { Deadline, DeadlineType } from '@/shared/schemas/deadline.js'

// Mock the api module so WallpaperView doesn't fire real fetch calls in tests
vi.mock('@/client/lib/api.js', () => ({
  getDeadlines: vi.fn(),
  getDeadlineTypes: vi.fn(),
  createDeadline: vi.fn(),
}))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function renderWithQuery(ui: React.ReactElement, { deadlines = [] as Deadline[], types = [] as DeadlineType[] } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  // Pre-populate the cache so useQuery reads from it without firing queryFn
  queryClient.setQueryData(['deadlines'], deadlines)
  queryClient.setQueryData(['deadline-types'], types)
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

const mockType: DeadlineType = {
  id: 1,
  name: 'Filing',
  color: '#1D4ED8',
  createdAt: '2026-01-01T00:00:00Z',
}

describe('WallpaperView smoke (HOOK-01)', () => {
  it('renders without throwing when given empty deadlines', () => {
    // W1: smoke render with empty data should not throw
    expect(() => renderWithQuery(<WallpaperView />)).not.toThrow()
  })

  it('renders 15 columns (1 Overdue + 14 day columns)', () => {
    // W2: exactly 15 columns via data-testid prefix
    const { container } = renderWithQuery(<WallpaperView />)
    const columns = container.querySelectorAll('[data-testid^="wallpaper-column-"]')
    expect(columns.length).toBe(15)
  })

  it('renders "Case Calendar Deadlines" header text', () => {
    // W3: locked header copy
    const { container } = renderWithQuery(<WallpaperView />)
    expect(container.textContent).toContain('Case Calendar Deadlines')
  })

  it('renders "Last updated:" timestamp text', () => {
    // W4: last-updated label always present
    const { container } = renderWithQuery(<WallpaperView />)
    expect(container.textContent).toContain('Last updated:')
  })

  it('applies 7680x2160 container styles (width: 7680px, height: 2160px)', () => {
    // W5: root element has the correct inline dimensions
    const { container } = renderWithQuery(<WallpaperView />)
    const root = container.firstElementChild as HTMLElement
    expect(root).not.toBeNull()
    expect(root.style.width).toBe('7680px')
    expect(root.style.height).toBe('2160px')
  })
})

describe('WallpaperView data selection', () => {
  it('places overdue deadlines (date < today AND completedAt === null) in the Overdue column', () => {
    // W6: overdue placement — pin system time to 2026-05-22
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 22)) // May = month index 4

    const overdueDeadline: Deadline = {
      id: 1,
      date: '2026-05-01',
      caseLabel: 'Smith v. State',
      typeId: 1,
      completedAt: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      description: null,
    }

    const { container } = renderWithQuery(<WallpaperView />, {
      deadlines: [overdueDeadline],
      types: [mockType],
    })

    const overdueColumn = container.querySelector('[data-testid="wallpaper-column-overdue"]')
    expect(overdueColumn).not.toBeNull()
    expect(overdueColumn!.textContent).toContain('Smith v. State')
  })

  it('places upcoming deadlines (date in next 14 days) in their matching date column', () => {
    // W7: upcoming placement — pin system time to 2026-05-22
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 22)) // May = month index 4

    const upcomingDeadline: Deadline = {
      id: 2,
      date: '2026-05-25',
      caseLabel: 'Jones v. Corp',
      typeId: 1,
      completedAt: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      description: null,
    }

    const { container } = renderWithQuery(<WallpaperView />, {
      deadlines: [upcomingDeadline],
      types: [mockType],
    })

    const dayColumn = container.querySelector('[data-testid="wallpaper-column-2026-05-25"]')
    expect(dayColumn).not.toBeNull()
    expect(dayColumn!.textContent).toContain('Jones v. Corp')
  })

  it('ignores completed deadlines (completedAt !== null) entirely', () => {
    // W8: completed deadlines must not appear anywhere in the wallpaper
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 22))

    const completedDeadline: Deadline = {
      id: 3,
      date: '2026-05-15',
      caseLabel: 'Completed Case',
      typeId: 1,
      completedAt: '2026-05-15T00:00:00Z',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-05-15T00:00:00Z',
      description: null,
    }

    const { container } = renderWithQuery(<WallpaperView />, {
      deadlines: [completedDeadline],
      types: [mockType],
    })

    // Completed deadline should not appear in any column
    expect(container.textContent).not.toContain('Completed Case')
  })

  it('overdue boundary: today\'s deadline is NOT in overdue column (strict <)', () => {
    // W9: a deadline dated today is in the day column, not overdue (strict < comparison)
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 22))

    const todayDeadline: Deadline = {
      id: 4,
      date: '2026-05-22',
      caseLabel: 'Today Deadline',
      typeId: 1,
      completedAt: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      description: null,
    }

    const { container } = renderWithQuery(<WallpaperView />, {
      deadlines: [todayDeadline],
      types: [mockType],
    })

    const overdueColumn = container.querySelector('[data-testid="wallpaper-column-overdue"]')
    // Today's deadline should NOT be in the overdue column
    expect(overdueColumn!.textContent).not.toContain('Today Deadline')

    // It SHOULD appear in the today day column
    const todayColumn = container.querySelector('[data-testid="wallpaper-column-2026-05-22"]')
    expect(todayColumn).not.toBeNull()
    expect(todayColumn!.textContent).toContain('Today Deadline')
  })

  it('empty overdue column shows "No overdue deadlines." copy', () => {
    // W10: locked empty-state copy per UI-SPEC §Copywriting Contract
    const { container } = renderWithQuery(<WallpaperView />)
    const overdueColumn = container.querySelector('[data-testid="wallpaper-column-overdue"]')
    expect(overdueColumn).not.toBeNull()
    expect(overdueColumn!.textContent).toContain('No overdue deadlines.')
  })

  it('XSS guard: caseLabel with HTML payload renders as escaped text (T-02-10)', () => {
    // W11: React text interpolation auto-escapes — no dangerouslySetInnerHTML
    const xssDeadline: Deadline = {
      id: 5,
      date: '2026-05-25',
      caseLabel: '<img src=x onerror=alert(1)>',
      typeId: 1,
      completedAt: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      description: null,
    }

    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 22))

    const { container } = renderWithQuery(<WallpaperView />, {
      deadlines: [xssDeadline],
      types: [mockType],
    })

    // The raw <img src=x onerror= substring must NOT appear in innerHTML
    expect(container.innerHTML).not.toContain('<img src=x onerror=')
  })
})
