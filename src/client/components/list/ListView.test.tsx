// @vitest-environment jsdom
// Wave 0 stub — ListView component
// Plan 03-04 (Wave 3) converts these it.todo stubs to live it() tests.
//
// Requirements: VIEW-03 (bucket ordering), VIEW-05 (single dataset feeds both views)
//
// NOTE: src/client/App.filters.test.tsx is NOT created in this plan (03-01).
// It is owned by Plan 03-04 (Wave 3) because it requires live FilterBar + ListView wiring
// to exercise the VIEW-05 single-dataset invariant. Per 03-VALIDATION.md row 03-04-02,
// App.filters.test.tsx lands when its target code lands.
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { Deadline, DeadlineType } from '@/shared/schemas/deadline.js'
import { ListView } from './ListView.js'

vi.mock('@/client/lib/api.js', () => ({
  getCases: vi.fn().mockResolvedValue([]),
  renameCase: vi.fn().mockResolvedValue({ changed: 0 }),
  setCaseArchived: vi.fn().mockResolvedValue(undefined),
  getSettings: vi.fn().mockResolvedValue({ wallpaperTheme: 'light', wallpaperBackground: null }),
  updateSettings: vi.fn().mockResolvedValue({ wallpaperTheme: 'light', wallpaperBackground: null }),
  uploadWallpaperBackground: vi.fn().mockResolvedValue({ version: 1 }),
  deleteWallpaperBackground: vi.fn().mockResolvedValue(undefined),
  wallpaperBackgroundUrl: (v: number) => `/api/wallpaper-background?v=${v}`,
  getCaseColors: vi.fn().mockResolvedValue([]),
  getDeadlineTypes: vi.fn().mockResolvedValue([]),
  getDeadlines: vi.fn().mockResolvedValue([]),
}))

afterEach(() => cleanup())

const TODAY = '2026-05-20' // Wednesday; thisWeek = 2026-05-17..2026-05-23; nextWeek = 2026-05-24..2026-05-30

// Types fixture
const TYPE_FILING: DeadlineType = { id: 1, name: 'Filing', color: '#1D4ED8', createdAt: '' }
const TYPE_HEARING: DeadlineType = { id: 2, name: 'Hearing', color: '#16A34A', createdAt: '' }

function renderWithQuery(
  ui: React.ReactElement,
  seed?: (queryClient: QueryClient) => void
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  })
  if (seed) seed(queryClient)
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

function makeDeadline(overrides: Partial<Deadline>): Deadline {
  return {
    id: 1,
    date: '2026-06-01',
    caseLabel: 'Smith v. Jones',
    typeId: 1,
    description: null,
    completedAt: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  }
}

// Fixture: deadlines spanning multiple buckets
// TODAY is 2026-05-20 (Wednesday)
// thisWeekStart = 2026-05-17 (Sunday), thisWeekEnd = 2026-05-23 (Saturday)
// nextWeekStart = 2026-05-24, nextWeekEnd = 2026-05-30
const fixtures: Deadline[] = [
  makeDeadline({ id: 1, date: '2026-05-22', caseLabel: 'Smith v. Jones' }),      // thisWeek (after today, still in this week)
  makeDeadline({ id: 2, date: '2026-05-20', caseLabel: 'Garcia v. City' }),      // today (=== TODAY)
  makeDeadline({ id: 3, date: '2026-05-10', caseLabel: 'Lee v. Corp', typeId: 2 }), // overdue
  makeDeadline({ id: 4, date: '2026-06-15', caseLabel: 'Davis v. Firm' }),       // later
]

describe('ListView — Wave 0 stubs (VIEW-03, VIEW-05)', () => {
  it('L1: bucket ordering — Overdue renders before Today, Today before ThisWeek, NextWeek before Later', () => {
    renderWithQuery(
      <ListView
        deadlines={fixtures}
        isLoading={false}
        isError={false}
filtersActive={false}
        todayStr={TODAY}
      />,
      qc => {
        qc.setQueryData(['deadline-types'], [TYPE_FILING, TYPE_HEARING])
      }
    )

    // Get all bucket header buttons and check order by textContent
    const allHeaders = screen.getAllByRole('button')
    const overduIdx = allHeaders.findIndex(h => h.textContent?.includes('Overdue'))
    const todayIdx = allHeaders.findIndex(h => h.textContent?.includes('Today'))
    const thisWeekIdx = allHeaders.findIndex(h => h.textContent?.includes('This Week'))
    const laterIdx = allHeaders.findIndex(h => h.textContent?.includes('Later'))

    expect(overduIdx).toBeGreaterThanOrEqual(0)
    expect(todayIdx).toBeGreaterThanOrEqual(0)
    expect(thisWeekIdx).toBeGreaterThanOrEqual(0)
    expect(laterIdx).toBeGreaterThanOrEqual(0)

    expect(overduIdx).toBeLessThan(todayIdx)
    expect(todayIdx).toBeLessThan(thisWeekIdx)
    expect(thisWeekIdx).toBeLessThan(laterIdx)
  })

  it('L2: empty buckets hidden — if "Next Week" has zero deadlines, no "Next Week" header renders', () => {
    renderWithQuery(
      <ListView
        deadlines={fixtures}
        isLoading={false}
        isError={false}
filtersActive={false}
        todayStr={TODAY}
      />,
      qc => {
        qc.setQueryData(['deadline-types'], [TYPE_FILING, TYPE_HEARING])
      }
    )

    // None of our fixtures fall in next week (2026-05-24 to 2026-05-30)
    // Use getAllByRole('button') to check no button has "Next Week" text
    const allButtons = screen.getAllByRole('button')
    const nextWeekBtn = allButtons.find(b => b.textContent?.includes('Next Week'))
    expect(nextWeekBtn).toBeUndefined()
  })

  it('L3: renders a DeadlineRow for each deadline in the active bucket', () => {
    // Use only today-bucket deadlines for clarity
    const todayDeadlines = [
      makeDeadline({ id: 1, date: TODAY, caseLabel: 'Smith v. Jones' }),
      makeDeadline({ id: 2, date: TODAY, caseLabel: 'Garcia v. City' }),
    ]
    renderWithQuery(
      <ListView
        deadlines={todayDeadlines}
        isLoading={false}
        isError={false}
filtersActive={false}
        todayStr={TODAY}
      />,
      qc => {
        qc.setQueryData(['deadline-types'], [TYPE_FILING])
      }
    )

    // Both case labels should be visible as rows
    expect(screen.getByText('Smith v. Jones')).toBeDefined()
    expect(screen.getByText('Garcia v. City')).toBeDefined()
  })

  it('L4: all-empty state — when ALL buckets are empty after filtering, renders "No deadlines match your filters." copy', () => {
    renderWithQuery(
      <ListView
        deadlines={[]}
        isLoading={false}
        isError={false}
filtersActive={true}
        todayStr={TODAY}
      />,
      qc => {
        qc.setQueryData(['deadline-types'], [TYPE_FILING])
      }
    )

    expect(screen.getByText('No deadlines match your filters.')).toBeDefined()
    // WR-03: duplicate Clear button removed from empty state — FilterBar's "Clear" button
    // is the single affordance (visible above the list at all times when filters are active).
  })

  it('L5: loading state renders skeleton rows', () => {
    const { container } = renderWithQuery(
      <ListView
        deadlines={undefined}
        isLoading={true}
        isError={false}
filtersActive={false}
        todayStr={TODAY}
      />
    )

    // Skeleton rows use animate-pulse class
    const skeletons = container.querySelectorAll('.animate-pulse')
    expect(skeletons.length).toBeGreaterThan(0)
  })

  it('L6: empty state without filters active shows Phase 1 EmptyState copy', () => {
    renderWithQuery(
      <ListView
        deadlines={[]}
        isLoading={false}
        isError={false}
filtersActive={false}
        todayStr={TODAY}
      />,
      qc => {
        qc.setQueryData(['deadline-types'], [TYPE_FILING])
      }
    )

    expect(screen.getByText('No deadlines yet.')).toBeDefined()
  })
})
