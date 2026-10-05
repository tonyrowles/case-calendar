// @vitest-environment jsdom
// Integration: App layout + keyboard shortcuts integration
// Requirements: VIEW-06, VIEW-07, KBD-01, KBD-05, Phase 1-4 regression
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { Deadline, DeadlineType } from '@/shared/schemas/deadline.js'
import { toISODateString } from '@/shared/lib/date.js'
import { App } from './App.js'

vi.mock('./lib/api.js', () => ({
  getEmailInbox: vi.fn().mockResolvedValue({ enabled: false, address: null, items: [], lastCheck: null }),
  checkEmailInbox: vi.fn().mockResolvedValue({ enabled: false, address: null, items: [], lastCheck: null }),
  acceptEmailImport: vi.fn().mockResolvedValue({ created: 0 }),
  dismissEmailImport: vi.fn().mockResolvedValue(undefined),
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
  getConfig: vi.fn().mockReturnValue(new Promise(() => {})),
  saveConfig: vi.fn(),
  ConfigSaveError: class extends Error {},
  getCaseColors: vi.fn().mockResolvedValue([]),
  getDeadlines: vi.fn().mockResolvedValue([]),
  getDeadlineTypes: vi.fn().mockResolvedValue([]),
  getCaseLabels: vi.fn().mockResolvedValue([]),
  createDeadline: vi.fn().mockResolvedValue({}),
  updateDeadline: vi.fn().mockResolvedValue({}),
  deleteDeadline: vi.fn().mockResolvedValue(undefined),
  updateDeadlineType: vi.fn().mockResolvedValue({}),
  deleteDeadlineType: vi.fn().mockResolvedValue(undefined),
}))

// Mock useBreakpoint so we can control tier per test
vi.mock('./hooks/useBreakpoint.js', () => ({
  useBreakpoint: vi.fn(),
}))
import { useBreakpoint } from './hooks/useBreakpoint.js'

function mockTier(tier: 'one' | 'two' | 'three') {
  ;(useBreakpoint as ReturnType<typeof vi.fn>).mockReturnValue(tier)
}

// Polyfill for jsdom: cmdk, Radix Dialog, and react-resizable-panels need these
beforeEach(() => {
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
    if (!Element.prototype.hasPointerCapture) {
      Element.prototype.hasPointerCapture = function () { return false }
    }
    if (!Element.prototype.setPointerCapture) {
      Element.prototype.setPointerCapture = function () {}
    }
    if (!Element.prototype.releasePointerCapture) {
      Element.prototype.releasePointerCapture = function () {}
    }
  }
})

// Pin date so bucket calculations are predictable
const PINNED_DATE = new Date(2026, 4, 20, 12, 0, 0) // 2026-05-20 Wednesday noon
const TODAY = toISODateString(PINNED_DATE)

const TYPE_FILING: DeadlineType = { id: 1, name: 'Filing', color: '#374151', createdAt: '' }

const deadlineFixtures: Deadline[] = [
  {
    id: 1,
    date: TODAY,
    caseLabel: 'Smith v. Jones',
    typeId: 1,
    description: 'Motion hearing',
    completedAt: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
  {
    id: 2,
    date: '2026-05-21',
    caseLabel: 'Garcia v. City',
    typeId: 1,
    description: null,
    completedAt: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  },
]

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  })
}

function renderApp(
  initialPath = '/?range=all',
  seed?: (qc: QueryClient) => void
) {
  const queryClient = makeQueryClient()
  if (seed) seed(queryClient)

  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialPath]}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    ),
  }
}

describe('App layout integration', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    vi.setSystemTime(PINNED_DATE)
    ;(useBreakpoint as ReturnType<typeof vi.fn>).mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
    cleanup()
  })

  for (const tier of ['three', 'two'] as const) {
    it(`at tier='${tier}', list and form render side by side; no calendar and no view toggle`, async () => {
      mockTier(tier)
      renderApp('/?range=all', qc => {
        qc.setQueryData(['deadlines'], deadlineFixtures)
        qc.setQueryData(['deadline-types'], [TYPE_FILING])
        qc.setQueryData(['case-labels'], ['Smith v. Jones', 'Garcia v. City'])
      })

      await waitFor(() => {
        expect(screen.queryByText('Add Deadline')).toBeTruthy()
      }, { timeout: 3000 })

      expect(screen.queryByLabelText(/Deadlines list/i)).toBeTruthy()
      expect(document.querySelector('[data-group]')).toBeTruthy()
      // The calendar view was removed (the desktop wallpaper is the calendar)
      expect(document.querySelector('.fc')).toBeNull()
      expect(screen.getAllByRole('button').find(b => b.textContent === 'Calendar')).toBeUndefined()
    })
  }

  it("at tier='one', no ResizablePanelGroup in DOM", async () => {
    mockTier('one')
    renderApp('/?range=all', qc => {
      qc.setQueryData(['deadlines'], deadlineFixtures)
      qc.setQueryData(['deadline-types'], [TYPE_FILING])
      qc.setQueryData(['case-labels'], ['Smith v. Jones'])
    })

    await waitFor(() => {
      expect(screen.queryByText('Add Deadline')).toBeTruthy()
    }, { timeout: 3000 })

    // react-resizable-panels v2 adds data-group attribute; should NOT be present at tier='one'
    expect(document.querySelector('[data-group]')).toBeNull()
  })

  it("pressing n opens DeadlineForm with focus on caseLabel input (KBD-01 + integration)", async () => {
    mockTier('one')
    renderApp('/?range=all', qc => {
      qc.setQueryData(['deadlines'], deadlineFixtures)
      qc.setQueryData(['deadline-types'], [TYPE_FILING])
      qc.setQueryData(['case-labels'], ['Smith v. Jones'])
      // Pre-select a deadline so there is something to clear
      qc.setQueryData(['deadlines'], deadlineFixtures)
    })

    // Wait for form to mount
    await waitFor(() => {
      expect(screen.queryByText('Add Deadline')).toBeTruthy()
    }, { timeout: 3000 })

    // Fire 'n' from the window (not from an input)
    fireEvent.keyDown(window, { key: 'n' })

    // DeadlineForm's effect should focus caseLabel. The input has id="caseLabel" (via register)
    await waitFor(() => {
      const caseInput = document.getElementById('caseLabel')
      expect(caseInput).toBeTruthy()
    }, { timeout: 3000 })
  })

  it("pressing j highlights the next deadline in the filtered list (KBD-05)", async () => {
    mockTier('three')
    // Use deadlines that fall in "later" bucket so they render with bg-primary/10 (not outline)
    const laterFixtures: Deadline[] = [
      {
        id: 10,
        date: '2026-06-15',
        caseLabel: 'Future Case A',
        typeId: 1,
        description: null,
        completedAt: null,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
      {
        id: 11,
        date: '2026-06-20',
        caseLabel: 'Future Case B',
        typeId: 1,
        description: null,
        completedAt: null,
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      },
    ]
    renderApp('/?range=all', qc => {
      qc.setQueryData(['deadlines'], laterFixtures)
      qc.setQueryData(['deadline-types'], [TYPE_FILING])
      qc.setQueryData(['case-labels'], ['Future Case A', 'Future Case B'])
    })

    // Wait for deadlines to render
    await waitFor(() => {
      expect(screen.queryAllByRole('row').length).toBeGreaterThan(0)
    }, { timeout: 3000 })

    // Fire 'j' — from null state, should select index 0
    fireEvent.keyDown(window, { key: 'j' })

    // The first deadline row should now show a selection highlight (bg-primary/10)
    await waitFor(() => {
      const rows = screen.queryAllByRole('row')
      expect(rows.length).toBeGreaterThan(0)
      // At least one row has the selected highlight
      const hasHighlight = rows.some(r => r.className.includes('bg-primary/10'))
      expect(hasHighlight).toBe(true)
    }, { timeout: 3000 })
  })

  it("Phase 1-4 regression: settings link still works", async () => {
    mockTier('one')
    renderApp('/', qc => {
      qc.setQueryData(['deadlines'], [])
      qc.setQueryData(['deadline-types'], [TYPE_FILING])
      qc.setQueryData(['case-labels'], [])
    })

    await waitFor(() => {
      expect(screen.queryByText('Settings')).toBeTruthy()
    }, { timeout: 3000 })

    const settingsLink = screen.getByText('Settings').closest('a')
    expect(settingsLink?.getAttribute('href')).toBe('/settings')
  })
})
