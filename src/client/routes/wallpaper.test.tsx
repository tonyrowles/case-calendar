// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { WallpaperView } from './wallpaper.js'
import { caseColor, caseTextColor } from '@/shared/lib/case-colors.js'
import type { Deadline, DeadlineType } from '@/shared/schemas/deadline.js'

// Mock the api module so WallpaperView doesn't fire real fetch calls in tests
vi.mock('@/client/lib/api.js', () => ({
  getCaseColors: vi.fn().mockResolvedValue([]),
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

  it('renders the rolling calendar and the upcoming list side by side', () => {
    // W2: calendar pane + list pane
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
    expect(container.querySelector('[data-testid="wallpaper-calendar"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="wallpaper-list"]')).not.toBeNull()
  })

  it('has no page title; header shows the rolling date range and today', () => {
    // W3: title removed (user request); header is range + today's date
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 22)) // Fri May 22, 2026
    const { container } = renderWithQuery(<WallpaperView />)
    expect(container.textContent).not.toContain('Case Calendar Deadlines')
    // Sun May 17 + 5 weeks - 1 day = Sat Jun 20
    expect(container.querySelector('[data-testid="wallpaper-range"]')!.textContent).toBe('May 17 – Jun 20, 2026')
    expect(container.textContent).toContain('Friday, May 22')
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
  it('past deadlines are not listed (no overdue section) but stay on the calendar, dimmed', () => {
    // W6: the wallpaper is a glance view, not a task list — no overdue treatment
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 22)) // Fri May 22; calendar starts Sun May 17

    const pastDeadline: Deadline = {
      id: 1,
      date: '2026-05-19',
      caseLabel: 'Smith v. State',
      typeId: 1,
      completedAt: null,
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      description: null,
    }

    const { container } = renderWithQuery(<WallpaperView />, {
      deadlines: [pastDeadline],
      types: [mockType],
    })

    expect(container.querySelector('[data-testid="wallpaper-bucket-overdue"]')).toBeNull()
    expect(container.querySelector('[data-testid="wallpaper-list"]')!.textContent).not.toContain('Smith v. State')
    const cell = container.querySelector('[data-testid="wallpaper-day-2026-05-19"]')!
    expect(cell.textContent).toContain('Smith v. State')
    expect(cell.className).toContain('opacity-40')
    expect(container.querySelector('.text-red-700')).toBeNull()
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

  it("today's deadline is in the today bucket and highlighted on the calendar", () => {
    // W9: a deadline dated today is in the today bucket
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

    const todayCell = container.querySelector('[data-testid="wallpaper-day-2026-05-22"]')!
    expect(todayCell.textContent).toContain('Today Deadline')
    expect(todayCell.className).not.toContain('opacity-40')

    // It SHOULD appear in the today bucket
    const todayBucket = container.querySelector('[data-testid="wallpaper-bucket-today"]')
    expect(todayBucket).not.toBeNull()
    expect(todayBucket!.textContent).toContain('Today Deadline')
  })

  it('empty today bucket shows "Nothing due today." copy', () => {
    // W10: empty-bucket copy
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 22))
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
    expect(container.querySelector('[data-testid="wallpaper-bucket-today"]')!.textContent).toContain('Nothing due today.')
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

describe('WALL-06: timestamp + layout + empty state', () => {
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

  it('list shows Today, This Week, Next Week, Later in order', () => {
    // T-W06-04: bucket order validated
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 22))
    const activeDeadline: Deadline = {
      id: 30,
      date: '2026-05-25',
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
    const ids = Array.from(container.querySelectorAll('[data-testid="wallpaper-list"] [data-testid^="wallpaper-bucket-"]'))
      .map(el => el.getAttribute('data-testid'))
    expect(ids).toEqual(['wallpaper-bucket-today', 'wallpaper-bucket-thisWeek', 'wallpaper-bucket-nextWeek', 'wallpaper-bucket-later'])
  })

  it('rolling calendar: this week plus the next 4, with month names at month boundaries', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 22)) // Fri May 22, 2026
    const mk = (id: number, date: string, caseLabel: string): Deadline => ({
      id, date, caseLabel, typeId: 1, completedAt: null,
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', description: null,
    })
    const { container } = renderWithQuery(<WallpaperView />, {
      deadlines: [mk(1, '2026-05-28', 'Future Case'), mk(2, '2026-06-18', 'Week Five Case'), mk(3, '2026-06-21', 'Beyond Range Case')],
      types: [mockType],
    })
    const cells = container.querySelectorAll('[data-testid^="wallpaper-day-"]')
    expect(cells.length).toBe(35)
    expect(cells[0].getAttribute('data-testid')).toBe('wallpaper-day-2026-05-17')
    expect(cells[34].getAttribute('data-testid')).toBe('wallpaper-day-2026-06-20')
    expect(cells[0].textContent).toContain('May 17')
    expect(container.querySelector('[data-testid="wallpaper-day-2026-06-01"]')!.textContent).toContain('Jun 1')
    expect(container.querySelector('[data-testid="wallpaper-day-2026-05-28"]')!.textContent).toContain('Future Case')
    expect(container.querySelector('[data-testid="wallpaper-day-2026-06-18"]')!.textContent).toContain('Week Five Case')
    // Past the calendar range: list only
    expect(container.querySelector('[data-testid="wallpaper-calendar"]')!.textContent).not.toContain('Beyond Range Case')
    expect(container.querySelector('[data-testid="wallpaper-bucket-later"]')!.textContent).toContain('Beyond Range Case')
  })

  it('rolling calendar: caps chips per cell at 3 and shows "+N more"', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 22))
    const many: Deadline[] = Array.from({ length: 7 }, (_, i) => ({
      id: 100 + i, date: '2026-05-27', caseLabel: `Case ${i}`, typeId: 1, completedAt: null,
      createdAt: `2026-01-01T00:00:0${i}Z`, updatedAt: '2026-01-01T00:00:00Z', description: null,
    }))
    const { container } = renderWithQuery(<WallpaperView />, { deadlines: many, types: [mockType] })
    const cell = container.querySelector('[data-testid="wallpaper-day-2026-05-27"]')!
    expect(cell.textContent).toContain('Case 2')
    expect(cell.textContent).not.toContain('Case 3')
    expect(cell.textContent).toContain('+4 more')
  })

  it('list shares a row budget across sections; overflow is an explicit "+N more"', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 22))
    const mk = (id: number, date: string): Deadline => ({
      id, date, caseLabel: `Case ${id}`, typeId: 1, completedAt: null,
      createdAt: `2026-01-01T00:00:${String(id).padStart(2, '0')}Z`, updatedAt: '2026-01-01T00:00:00Z', description: null,
    })
    // 12 next week + 5 later = 17 rows > 14-row budget
    const deadlines = [
      ...Array.from({ length: 12 }, (_, i) => mk(i + 1, '2026-05-26')),
      ...Array.from({ length: 5 }, (_, i) => mk(i + 20, '2026-07-01')),
    ]
    const { container } = renderWithQuery(<WallpaperView />, { deadlines, types: [mockType] })
    const nextWeek = container.querySelector('[data-testid="wallpaper-bucket-nextWeek"]')!
    expect(nextWeek.textContent).not.toContain('more')
    const later = container.querySelector('[data-testid="wallpaper-bucket-later"]')!
    expect(later.textContent).toContain('Case 21')
    expect(later.textContent).not.toContain('Case 22')
    expect(later.textContent).toContain('+3 more')
  })

  it('list rows show the deadline date', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 22))
    const d: Deadline = {
      id: 7, date: '2026-05-25', caseLabel: 'Dated Case', typeId: 1, completedAt: null,
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', description: null,
    }
    const { container } = renderWithQuery(<WallpaperView />, { deadlines: [d], types: [mockType] })
    expect(container.querySelector('[data-testid="wallpaper-bucket-nextWeek"]')!.textContent).toContain('Mon, May 25')
  })

  it('shows the first line of the description as the event title, with case · type beneath', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 22))
    const d: Deadline = {
      id: 8, date: '2026-05-26', caseLabel: 'Smith v. Jones', typeId: 1, completedAt: null,
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
      description: '\n  Smith Deposition  \nZoom link in email; court reporter booked',
    }
    const { container } = renderWithQuery(<WallpaperView />, { deadlines: [d], types: [mockType] })
    const chip = container.querySelector('[data-testid="wallpaper-day-2026-05-26"] [data-testid="wallpaper-chip"]')!
    expect(chip.children[0].textContent).toBe('Smith Deposition')
    expect(chip.children[1].textContent).toBe('Smith v. Jones · Filing')
    expect(container.textContent).not.toContain('court reporter')
    expect(container.querySelector('[data-testid="wallpaper-bucket-nextWeek"]')!.textContent).toContain('Smith Deposition')
  })

  it('colors by case: same case -> same color regardless of type; the case name carries the color', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 22))
    const otherType: DeadlineType = { id: 2, name: 'Hearing', color: '#B91C1C', createdAt: '2026-01-01T00:00:00Z' }
    const mk = (id: number, date: string, caseLabel: string, typeId: number): Deadline => ({
      id, date, caseLabel, typeId, completedAt: null,
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', description: `Event ${id}`,
    })
    const { container } = renderWithQuery(<WallpaperView />, {
      deadlines: [mk(1, '2026-05-26', 'Smith v. Jones', 1), mk(2, '2026-05-27', 'Smith v. Jones', 2)],
      types: [mockType, otherType],
    })
    const chips = container.querySelectorAll<HTMLElement>('[data-testid="wallpaper-calendar"] [data-testid="wallpaper-chip"]')
    expect(chips.length).toBe(2)
    const expected = caseColor('Smith v. Jones')
    const toRgb = (hex: string) => `rgb(${parseInt(hex.slice(1, 3), 16)}, ${parseInt(hex.slice(3, 5), 16)}, ${parseInt(hex.slice(5, 7), 16)})`
    for (const chip of chips) {
      expect(chip.style.borderColor).toBe(toRgb(expected))
      const badge = chip.querySelector('[data-testid="wallpaper-case-badge"]') as HTMLElement
      expect(badge.textContent).toBe('Smith v. Jones')
      expect(badge.style.backgroundColor).toBe(toRgb(expected))
      expect(badge.style.color).toBe(toRgb(caseTextColor(expected)))
    }
  })

  it('falls back to the type name as the title when there is no description', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 22))
    const d: Deadline = {
      id: 9, date: '2026-05-26', caseLabel: 'Doe v. Roe', typeId: 1, completedAt: null,
      createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z', description: '   ',
    }
    const { container } = renderWithQuery(<WallpaperView />, { deadlines: [d], types: [mockType] })
    const chip = container.querySelector('[data-testid="wallpaper-day-2026-05-26"] [data-testid="wallpaper-chip"]')!
    expect(chip.children[0].textContent).toBe('Filing')
    expect(chip.children[1].textContent).toBe('Doe v. Roe')
  })

  it('renders "All caught up" empty state when no upcoming deadlines AND keeps the timestamp footer', () => {
    // T-W06-05: empty-state renders correctly; timestamp footer still present
    const { container } = renderWithQuery(<WallpaperView />)   // empty deadlines by default
    expect(container.textContent).toContain('All caught up')
    expect(container.querySelector('[data-testid="wallpaper-timestamp"]')).not.toBeNull()
    // Buckets are NOT rendered when allEmpty; the calendar still is
    expect(container.querySelector('[data-testid="wallpaper-bucket-today"]')).toBeNull()
    expect(container.querySelector('[data-testid="wallpaper-calendar"]')).not.toBeNull()
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
