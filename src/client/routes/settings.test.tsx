// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { DeadlineType } from '@/shared/schemas/deadline.js'
import { SettingsPage } from './settings.js'

// TYPE-01..04: Settings page — types list, AddTypeRow, no FilterBar

vi.mock('@/client/lib/api.js', () => ({
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
  getCaseColors: vi.fn().mockResolvedValue([]),
  setCaseColor: vi.fn().mockResolvedValue({}),
  resetCaseColor: vi.fn().mockResolvedValue(undefined),
  getDeadlineTypes: vi.fn().mockResolvedValue([]),
  getDeadlines: vi.fn().mockResolvedValue([]),
  getCaseLabels: vi.fn().mockResolvedValue([]),
  createDeadline: vi.fn().mockResolvedValue({}),
  createDeadlineType: vi.fn().mockResolvedValue({}),
  updateDeadlineType: vi.fn().mockResolvedValue({}),
  deleteDeadlineType: vi.fn().mockResolvedValue(undefined),
}))

afterEach(() => cleanup())

const typeFixtures: DeadlineType[] = [
  { id: 1, name: 'Filing', color: '#374151', createdAt: '' },
  { id: 2, name: 'Hearing', color: '#374151', createdAt: '' },
]

function renderSettings(seed?: (qc: QueryClient) => void) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  })
  if (seed) seed(queryClient)
  return { queryClient, ...render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/settings']}>
        <SettingsPage />
      </MemoryRouter>
    </QueryClientProvider>
  )}
}

describe('Settings page (TYPE-01..04)', () => {
  it('renders "Settings" h2 heading and "Deadline Types" h3 subheading', async () => {
    renderSettings(qc => {
      qc.setQueryData(['deadline-types'], typeFixtures)
    })
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy()
      expect(screen.getByRole('heading', { name: 'Deadline Types' })).toBeTruthy()
    })
  })

  it('types list loads from ["deadline-types"] query cache', async () => {
    renderSettings(qc => {
      qc.setQueryData(['deadline-types'], typeFixtures)
    })
    await waitFor(() => {
      expect(screen.getByText('Filing')).toBeTruthy()
      expect(screen.getByText('Hearing')).toBeTruthy()
    })
  })

  it('AddTypeRow renders at the bottom of the types list', async () => {
    renderSettings(qc => {
      qc.setQueryData(['deadline-types'], typeFixtures)
    })
    await waitFor(() => {
      const input = screen.getByRole('textbox', { name: /new type name/i })
      expect(input).toBeTruthy()
    })
  })

  it('FilterBar is NOT rendered on the settings page', async () => {
    renderSettings(qc => {
      qc.setQueryData(['deadline-types'], typeFixtures)
    })
    await waitFor(() => {
      // Settings heading should appear (confirms page rendered)
      expect(screen.getByRole('heading', { name: 'Settings' })).toBeTruthy()
    })
    // FilterBar has a "Show completed" switch label and a "Clear" button
    expect(screen.queryByText('Show completed')).toBeNull()
    expect(screen.queryByRole('button', { name: /clear all filters/i })).toBeNull()
  })

  it('back link navigating to / exists on the page', async () => {
    renderSettings(qc => {
      qc.setQueryData(['deadline-types'], typeFixtures)
    })
    await waitFor(() => {
      const backLink = screen.getByRole('link', { name: /Case Calendar/ })
      expect(backLink).toBeTruthy()
      expect(backLink.getAttribute('href')).toBe('/')
    })
  })

  it('loading state renders card container without crashing', () => {
    // Don't seed cache — query will be loading
    renderSettings()
    // Settings page wrapper renders immediately
    expect(document.body.innerHTML).toContain('Settings')
  })

  it('error state shows error message when query fails', async () => {
    // Use a query client that starts with an error state
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
        mutations: { retry: false },
      },
    })
    queryClient.setQueryData(['deadline-types'], undefined)
    // Force an error state by setting it directly
    queryClient.getQueryCache().find({ queryKey: ['deadline-types'] })

    const { getDeadlineTypes } = await import('@/client/lib/api.js')
    vi.mocked(getDeadlineTypes).mockRejectedValueOnce(new Error('Network error'))

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/settings']}>
          <SettingsPage />
        </MemoryRouter>
      </QueryClientProvider>
    )
    await waitFor(() => {
      expect(screen.getByText(/Couldn't load deadline types/i)).toBeTruthy()
    }, { timeout: 3000 })
  })
})
