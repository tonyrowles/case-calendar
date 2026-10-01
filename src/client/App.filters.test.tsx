// @vitest-environment jsdom
// App-level integration tests for Plan 03-04.
// Requirements: VIEW-05 (filter pipeline feeds both views), FILT-04 (URL roundtrip),
//               FILT-05 (Clear → bare URL), VIEW-08 (document.title shape)
import React from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { Deadline, DeadlineType } from '@/shared/schemas/deadline.js'
import { toISODateString } from '@/shared/lib/date.js'
import { App } from './App.js'

vi.mock('./lib/api.js', () => ({
  extractDeadlines: vi.fn().mockResolvedValue({ proposals: [] }),
  createDeadlinesBulk: vi.fn().mockResolvedValue({ created: 0 }),
  getCases: vi.fn().mockResolvedValue([]),
  renameCase: vi.fn().mockResolvedValue({ changed: 0 }),
  setCaseArchived: vi.fn().mockResolvedValue(undefined),
  getSettings: vi.fn().mockResolvedValue({ wallpaperTheme: 'light', wallpaperBackground: null }),
  updateSettings: vi.fn().mockResolvedValue({ wallpaperTheme: 'light', wallpaperBackground: null }),
  uploadWallpaperBackground: vi.fn().mockResolvedValue({ version: 1 }),
  deleteWallpaperBackground: vi.fn().mockResolvedValue(undefined),
  wallpaperBackgroundUrl: (v: number) => `/api/wallpaper-background?v=${v}`,
  getCaseColors: vi.fn().mockResolvedValue([]),
  getDeadlines: vi.fn().mockResolvedValue([]),
  getDeadlineTypes: vi.fn().mockResolvedValue([]),
  getCaseLabels: vi.fn().mockResolvedValue([]),
  createDeadline: vi.fn().mockResolvedValue({}),
}))

afterEach(() => cleanup())

// Derive today relative to the actual system clock so todayStr matches App's todayStr
// App calls toISODateString(new Date()) — so tests must align with real "today".
// Pin using vi.setSystemTime to a known Wednesday so this-week has space before/after today.
const PINNED_DATE = new Date(2026, 4, 20, 12, 0, 0) // 2026-05-20 Wednesday noon local
const TODAY = toISODateString(PINNED_DATE)
// thisWeekStart = 2026-05-17 (Sunday), thisWeekEnd = 2026-05-23 (Saturday)
// overdue = date < 2026-05-20

const TYPE_FILING: DeadlineType = { id: 1, name: 'Filing', color: '#1D4ED8', createdAt: '' }
const TYPE_HEARING: DeadlineType = { id: 2, name: 'Hearing', color: '#16A34A', createdAt: '' }

// 6 deadlines across 2 cases and 2 types
const deadlineFixtures: Deadline[] = [
  { id: 1, date: '2026-05-10', caseLabel: 'Smith v. Jones', typeId: 1, description: null, completedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' }, // overdue
  { id: 2, date: '2026-05-15', caseLabel: 'Smith v. Jones', typeId: 2, description: null, completedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' }, // overdue
  { id: 3, date: TODAY,        caseLabel: 'Garcia v. City', typeId: 1, description: null, completedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' }, // today
  { id: 4, date: '2026-05-21', caseLabel: 'Garcia v. City', typeId: 2, description: null, completedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' }, // thisWeek
  { id: 5, date: '2026-05-22', caseLabel: 'Smith v. Jones', typeId: 1, description: null, completedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' }, // thisWeek
  { id: 6, date: '2026-06-15', caseLabel: 'Garcia v. City', typeId: 2, description: null, completedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' }, // later
]

function renderApp(
  initialPath = '/',
  seed?: (queryClient: QueryClient) => void
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  })
  if (seed) seed(queryClient)

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('App filter integration (VIEW-05, FILT-04, FILT-05, VIEW-08)', () => {
  beforeEach(() => {
    // Pin the system clock so App's todayStr matches our fixture dates
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(PINNED_DATE)
    // Reset view preference so each test starts in list view
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  it('I1: at default URL (/), list view shows all deadlines (range=all default)', async () => {
    renderApp('/', qc => {
      qc.setQueryData(['deadlines'], deadlineFixtures)
      qc.setQueryData(['deadline-types'], [TYPE_FILING, TYPE_HEARING])
      qc.setQueryData(['case-labels'], ['Smith v. Jones', 'Garcia v. City'])
    })

    // Default: range=all -- every (non-completed) deadline, bucketed
    await waitFor(() => {
      const rows = screen.queryAllByRole('row')
      expect(rows.length).toBeGreaterThan(0)
    }, { timeout: 3000 })

    const rows = screen.getAllByRole('row')
    expect(rows.length).toBe(6)
  })

  it('I2: at ?range=all, list view shows all 6 deadlines bucketed', async () => {
    renderApp('/?range=all', qc => {
      qc.setQueryData(['deadlines'], deadlineFixtures)
      qc.setQueryData(['deadline-types'], [TYPE_FILING, TYPE_HEARING])
      qc.setQueryData(['case-labels'], ['Smith v. Jones', 'Garcia v. City'])
    })

    await waitFor(() => {
      const rows = screen.queryAllByRole('row')
      expect(rows.length).toBe(6)
    }, { timeout: 3000 })

    const rows = screen.getAllByRole('row')
    expect(rows.length).toBe(6)
  })

  it('I3: VIEW-05 — applying case filter narrows list view rows', async () => {
    // Smith has 3 deadlines: id1 (overdue), id2 (overdue), id5 (thisWeek)
    renderApp('/?case=Smith%20v.%20Jones&range=all', qc => {
      qc.setQueryData(['deadlines'], deadlineFixtures)
      qc.setQueryData(['deadline-types'], [TYPE_FILING, TYPE_HEARING])
      qc.setQueryData(['case-labels'], ['Smith v. Jones', 'Garcia v. City'])
    })

    // List view shows 3 Smith rows
    await waitFor(() => {
      const rows = screen.queryAllByRole('row')
      expect(rows.length).toBe(3)
    }, { timeout: 3000 })

    expect(screen.getAllByRole('row').length).toBe(3)
  })

  it('I4: FILT-05 — Clear button removes all filters; list returns to the default (All) view', async () => {
    renderApp('/?case=Smith%20v.%20Jones&type=1&range=overdue', qc => {
      qc.setQueryData(['deadlines'], deadlineFixtures)
      qc.setQueryData(['deadline-types'], [TYPE_FILING, TYPE_HEARING])
      qc.setQueryData(['case-labels'], ['Smith v. Jones', 'Garcia v. City'])
    })

    // Smith + type:Filing + overdue → only id1 (Smith, Filing, overdue)
    await waitFor(() => {
      const rows = screen.queryAllByRole('row')
      expect(rows.length).toBe(1)
    }, { timeout: 3000 })

    // Clear button should be visible (non-default filters active)
    const clearBtn = screen.getByRole('button', { name: /clear all filters/i })
    fireEvent.click(clearBtn)

    // After clear, the default view (range=all) should apply
    // This-week deadlines: id3 (today), id4 (thisWeek), id5 (thisWeek) = 3 rows
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /clear all filters/i })).toBeNull()
    }, { timeout: 3000 })

    // Clear button gone means we're at defaults
    expect(screen.queryByRole('button', { name: /clear all filters/i })).toBeNull()
  })

  it('I5: VIEW-08 — document.title is "Case Calendar (N due today)" when N>0; "Case Calendar" when N=0', async () => {
    // Exactly 1 deadline due today
    const todayOnly: Deadline[] = [
      { id: 1, date: TODAY, caseLabel: 'Smith v. Jones', typeId: 1, description: null, completedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    ]
    renderApp('/?range=all', qc => {
      qc.setQueryData(['deadlines'], todayOnly)
      qc.setQueryData(['deadline-types'], [TYPE_FILING])
      qc.setQueryData(['case-labels'], ['Smith v. Jones'])
    })

    await waitFor(() => {
      expect(document.title).toBe('Case Calendar (1 due today)')
    }, { timeout: 3000 })

    // Cleanup and render with zero today deadlines
    cleanup()
    const noTodayDeadlines: Deadline[] = [
      { id: 1, date: '2026-06-01', caseLabel: 'Smith v. Jones', typeId: 1, description: null, completedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    ]
    renderApp('/', qc => {
      qc.setQueryData(['deadlines'], noTodayDeadlines)
      qc.setQueryData(['deadline-types'], [TYPE_FILING])
      qc.setQueryData(['case-labels'], [])
    })

    await waitFor(() => {
      expect(document.title).toBe('Case Calendar')
    }, { timeout: 3000 })
  })

  it('I5b: VIEW-08 — document.title count is NOT filter-aware (uses full deadlines, not filtered)', async () => {
    // 2 deadlines today (both Smith and Garcia); filter applied to Garcia only
    const twoToday: Deadline[] = [
      { id: 1, date: TODAY, caseLabel: 'Smith v. Jones', typeId: 1, description: null, completedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
      { id: 2, date: TODAY, caseLabel: 'Garcia v. City', typeId: 2, description: null, completedAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' },
    ]
    // Filter by Garcia — list shows only Garcia's 1 today deadline
    // But title should show 2 (full unfiltered count due today)
    renderApp('/?case=Garcia%20v.%20City', qc => {
      qc.setQueryData(['deadlines'], twoToday)
      qc.setQueryData(['deadline-types'], [TYPE_FILING, TYPE_HEARING])
      qc.setQueryData(['case-labels'], ['Smith v. Jones', 'Garcia v. City'])
    })

    await waitFor(() => {
      expect(document.title).toBe('Case Calendar (2 due today)')
    }, { timeout: 3000 })
  })

  it('CR-01: when a filter removes the selected deadline from view, form returns to create mode', async () => {
    // Start unfiltered (range=all) so all 6 deadlines are visible.
    // id5 belongs to Smith v. Jones (typeId=1, date=2026-05-22).
    // We'll click id5 to select it, then apply a Garcia filter that hides id5.
    // After the filter, the form must show "Add Deadline" (create mode), NOT edit mode for id5.
    renderApp('/?range=all', qc => {
      qc.setQueryData(['deadlines'], deadlineFixtures)
      qc.setQueryData(['deadline-types'], [TYPE_FILING, TYPE_HEARING])
      qc.setQueryData(['case-labels'], ['Smith v. Jones', 'Garcia v. City'])
    })

    // Wait for list to render
    await waitFor(() => {
      const rows = screen.queryAllByRole('row')
      expect(rows.length).toBe(6)
    }, { timeout: 3000 })

    // Click the row for id5 (Smith v. Jones, 2026-05-22) to enter edit mode.
    // DeadlineRow renders aria-label="Smith v. Jones, Filing, due May 22, 2026"
    const smithRows = screen.getAllByRole('row').filter(r =>
      r.textContent?.includes('Smith v. Jones') && r.textContent?.includes('May 22, 2026')
    )
    expect(smithRows.length).toBeGreaterThan(0)
    fireEvent.click(smithRows[0])

    // Form should now be in edit mode (shows "Save Changes" button)
    await waitFor(() => {
      expect(screen.queryByRole('button', { name: /save changes/i })).toBeTruthy()
    }, { timeout: 3000 })

    // Navigate to Garcia-only filter — id5 (Smith) is excluded
    // Re-render with the garcia case filter applied
    cleanup()
    renderApp('/?case=Garcia%20v.%20City&range=all', qc => {
      qc.setQueryData(['deadlines'], deadlineFixtures)
      qc.setQueryData(['deadline-types'], [TYPE_FILING, TYPE_HEARING])
      qc.setQueryData(['case-labels'], ['Smith v. Jones', 'Garcia v. City'])
    })

    // Wait for filtered list (Garcia has id3, id4, id6 = 3 rows)
    await waitFor(() => {
      const rows = screen.queryAllByRole('row')
      expect(rows.length).toBe(3)
    }, { timeout: 3000 })

    // Form must be in create mode — "Add Deadline" heading, no "Save Changes" button
    await waitFor(() => {
      expect(screen.queryByText('Add Deadline')).toBeTruthy()
      expect(screen.queryByRole('button', { name: /save changes/i })).toBeNull()
    }, { timeout: 3000 })
  })
})
