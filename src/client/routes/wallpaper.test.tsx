// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
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

function renderWithQuery(ui: React.ReactElement, { deadlines = [] as Deadline[], types = [] as DeadlineType[], initialPath = '/' } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  // Pre-populate the cache so useQuery reads from it without firing queryFn
  queryClient.setQueryData(['deadlines'], deadlines)
  queryClient.setQueryData(['deadline-types'], types)
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
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

  it('renders 3 columns (priority | current | later)', () => {
    // W2: exactly 3 columns via data-testid prefix (new 3-column layout)
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 22))
    // Need at least one deadline so allEmpty is false and the grid renders
    const activeDeadline: Deadline = {
      id: 99,
      date: '2026-05-01',
      caseLabel: 'Active Case',
      typeId: 1,
      completedAt: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      description: null,
    }
    const { container } = renderWithQuery(<WallpaperView />, {
      deadlines: [activeDeadline],
      types: [mockType],
    })
    const columns = container.querySelectorAll('[data-testid^="wallpaper-column-"]')
    expect(columns.length).toBe(3)
  })

  it('renders "Case Calendar Deadlines" header text', () => {
    // W3: locked header copy
    const { container } = renderWithQuery(<WallpaperView />)
    expect(container.textContent).toContain('Case Calendar Deadlines')
  })

  it('renders "Last updated" timestamp text in the bottom-right footer', () => {
    // W4: last-updated label always present (new testid-based assertion)
    const { container } = renderWithQuery(<WallpaperView />)
    const footer = container.querySelector('[data-testid="wallpaper-timestamp"]')
    expect(footer).not.toBeNull()
    expect(footer!.textContent).toContain('Last updated')
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
  it('places overdue deadlines (date < today AND completedAt === null) in the overdue bucket', () => {
    // W6: overdue placement — pin system time to 2026-05-22 (now uses wallpaper-bucket-overdue)
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

    const overdueBucket = container.querySelector('[data-testid="wallpaper-bucket-overdue"]')
    expect(overdueBucket).not.toBeNull()
    expect(overdueBucket!.textContent).toContain('Smith v. State')
  })

  it('places upcoming deadlines (date in next 14 days) in their matching week bucket', () => {
    // W7: upcoming placement — pin system time to 2026-05-22 (Friday)
    // 2026-05-25 (Monday) is in next-week range [Sun May 24 – Sat May 30]
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

    const nextWeekBucket = container.querySelector('[data-testid="wallpaper-bucket-nextWeek"]')
    expect(nextWeekBucket).not.toBeNull()
    expect(nextWeekBucket!.textContent).toContain('Jones v. Corp')
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

  it("overdue boundary: today's deadline is NOT in overdue bucket but IS in today bucket", () => {
    // W9: a deadline dated today is in the today bucket, not overdue (strict < comparison)
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

    const overdueBucket = container.querySelector('[data-testid="wallpaper-bucket-overdue"]')
    // Today's deadline should NOT be in the overdue bucket
    expect(overdueBucket!.textContent).not.toContain('Today Deadline')

    // It SHOULD appear in the today bucket
    const todayBucket = container.querySelector('[data-testid="wallpaper-bucket-today"]')
    expect(todayBucket).not.toBeNull()
    expect(todayBucket!.textContent).toContain('Today Deadline')
  })

  it('empty overdue bucket shows "No overdue deadlines." copy', () => {
    // W10: locked empty-state copy per UI-SPEC §Copywriting Contract
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 22))
    // Need a non-overdue deadline so allEmpty is false and columns render
    const futureDeadline: Deadline = {
      id: 20,
      date: '2026-05-25',
      caseLabel: 'Future Case',
      typeId: 1,
      completedAt: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      description: null,
    }
    const { container } = renderWithQuery(<WallpaperView />, {
      deadlines: [futureDeadline],
      types: [mockType],
    })
    const overdueBucket = container.querySelector('[data-testid="wallpaper-bucket-overdue"]')
    expect(overdueBucket).not.toBeNull()
    expect(overdueBucket!.textContent).toContain('No overdue deadlines.')
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

describe('WALL-06: timestamp + 3-column + empty state', () => {
  it('renders formatted timestamp from ?t= query param', () => {
    // T-W06-01: May 24 2026 3:30 PM Pacific — TZ env is America/Los_Angeles
    const t = new Date(2026, 4, 24, 15, 30, 0).getTime()
    const { container } = renderWithQuery(<WallpaperView />, { initialPath: `/?t=${t}` })
    const footer = container.querySelector('[data-testid="wallpaper-timestamp"]')
    expect(footer).not.toBeNull()
    expect(footer!.textContent).toContain('3:30 PM')
    expect(footer!.textContent).toContain('May 24, 2026')
  })

  it('falls back to new Date() when ?t= is absent', () => {
    // T-W06-02: missing ?t= uses current time (pinned via fake timers)
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 24, 9, 15, 0))
    const { container } = renderWithQuery(<WallpaperView />)
    const footer = container.querySelector('[data-testid="wallpaper-timestamp"]')
    expect(footer).not.toBeNull()
    expect(footer!.textContent).toContain('Last updated')
    expect(footer!.textContent).toContain('9:15 AM')
    expect(footer!.textContent).toContain('May 24, 2026')
  })

  it('falls back to new Date() when ?t= is non-numeric', () => {
    // T-W06-03: malformed ?t= (non-numeric) falls back gracefully
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 24, 9, 15, 0))
    const { container } = renderWithQuery(<WallpaperView />, { initialPath: '/?t=notanumber' })
    const footer = container.querySelector('[data-testid="wallpaper-timestamp"]')
    expect(footer!.textContent).toContain('9:15 AM')
    expect(footer!.textContent).toContain('May 24, 2026')
  })

  it('3-column structure: priority contains overdue+today; current contains thisWeek+nextWeek; later contains later', () => {
    // T-W06-04: column hierarchy validated
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 22))
    // Need a non-empty deadline so the 3-column grid renders (not the allEmpty state)
    const activeDeadline: Deadline = {
      id: 30,
      date: '2026-05-01',
      caseLabel: 'Active Case',
      typeId: 1,
      completedAt: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      description: null,
    }
    const { container } = renderWithQuery(<WallpaperView />, {
      deadlines: [activeDeadline],
      types: [mockType],
    })
    const priority = container.querySelector('[data-testid="wallpaper-column-priority"]')
    expect(priority!.querySelector('[data-testid="wallpaper-bucket-overdue"]')).not.toBeNull()
    expect(priority!.querySelector('[data-testid="wallpaper-bucket-today"]')).not.toBeNull()
    const current = container.querySelector('[data-testid="wallpaper-column-current"]')
    expect(current!.querySelector('[data-testid="wallpaper-bucket-thisWeek"]')).not.toBeNull()
    expect(current!.querySelector('[data-testid="wallpaper-bucket-nextWeek"]')).not.toBeNull()
    const later = container.querySelector('[data-testid="wallpaper-column-later"]')
    expect(later!.querySelector('[data-testid="wallpaper-bucket-later"]')).not.toBeNull()
  })

  it('renders "All caught up" empty state when no upcoming deadlines AND keeps the timestamp footer', () => {
    // T-W06-05: empty-state renders correctly; timestamp footer still present
    const { container } = renderWithQuery(<WallpaperView />)   // empty deadlines by default
    expect(container.textContent).toContain('All caught up')
    expect(container.querySelector('[data-testid="wallpaper-timestamp"]')).not.toBeNull()
    // 3-column grid is NOT rendered when allEmpty
    expect(container.querySelector('[data-testid="wallpaper-column-priority"]')).toBeNull()
  })

  it('completed deadlines are always hidden from the wallpaper view regardless of ?completed= param', () => {
    // T-W06-06: wallpaper uses groupByBucket which always excludes completedAt !== null deadlines.
    // Unlike the main list view (which toggles completed visibility), the wallpaper is a
    // display-only view showing upcoming deadlines only — completed items are never rendered.
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 22))
    const completedToday: Deadline = {
      id: 10,
      date: '2026-05-22',
      caseLabel: 'Done Today',
      typeId: 1,
      completedAt: '2026-05-22T10:00:00Z',
      createdAt: '2026-05-22T00:00:00Z',
      updatedAt: '2026-05-22T10:00:00Z',
      description: null,
    }
    const { container } = renderWithQuery(<WallpaperView />, {
      deadlines: [completedToday], types: [mockType], initialPath: '/?completed=1',
    })
    // The completed deadline should NOT appear even with ?completed=1
    // because groupByBucket always excludes completedAt !== null items
    expect(container.textContent).not.toContain('Done Today')
    // Timestamp footer is still present
    expect(container.querySelector('[data-testid="wallpaper-timestamp"]')).not.toBeNull()
  })
})
