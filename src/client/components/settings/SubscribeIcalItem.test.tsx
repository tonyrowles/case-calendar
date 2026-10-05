// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { SubscribeIcalItem } from './SubscribeIcalItem.js'

// Hoist mock to top level (required by vitest module mocking rules)
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
  getConfig: vi.fn().mockReturnValue(new Promise(() => {})),
  saveConfig: vi.fn(),
  ConfigSaveError: class extends Error {},
  getCaseColors: vi.fn().mockResolvedValue([]),
  getCaseLabels: vi.fn().mockResolvedValue([]),
  getDeadlines: vi.fn().mockResolvedValue([]),
  setCaseColor: vi.fn().mockResolvedValue({}),
  resetCaseColor: vi.fn().mockResolvedValue(undefined),
  getDeadlineTypes: vi.fn().mockResolvedValue([]),
  createDeadlineType: vi.fn(),
  updateDeadlineType: vi.fn(),
  deleteDeadlineType: vi.fn(),
}))

const WEBCAL_URL = 'webcal://localhost:3747/api/deadlines.ics'

// Restore clipboard after each test
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

function mockClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
    writable: true,
  })
}

function renderItem() {
  return render(<SubscribeIcalItem />)
}

describe('SubscribeIcalItem', () => {
  it('Test 1 (initial render): renders label, description, Calendar icon, Copy button', () => {
    renderItem()
    expect(screen.getByText('Subscribe (iCal)')).toBeTruthy()
    expect(
      screen.getByText('Copy the webcal:// link to subscribe in Outlook or Apple Calendar')
    ).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Copy iCal subscription link' })).toBeTruthy()
  })

  it('Test 2 (copy success → Check icon + Copied! announcement): clipboard writeText called with webcal URL', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    mockClipboard(writeText)

    renderItem()
    const button = screen.getByRole('button', { name: 'Copy iCal subscription link' })
    fireEvent.click(button)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Link copied' })).toBeTruthy()
    })

    expect(screen.getByText('Copied!')).toBeTruthy()
    expect(writeText).toHaveBeenCalledWith(WEBCAL_URL)
  })

  it('Test 3 (copy failure → fallback URL visible): shows raw URL and Copy failed announcement', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Permission denied'))
    mockClipboard(writeText)

    renderItem()
    fireEvent.click(screen.getByRole('button', { name: 'Copy iCal subscription link' }))

    await waitFor(() => {
      expect(screen.getByText('Copy failed')).toBeTruthy()
    })

    expect(screen.getByText(WEBCAL_URL)).toBeTruthy()
  })

  it('Test 4 (state reverts after timeout): after 2s Check icon reverts to Copy icon', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    mockClipboard(writeText)

    renderItem()
    fireEvent.click(screen.getByRole('button', { name: 'Copy iCal subscription link' }))

    // Wait for state update from the resolved promise
    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByRole('button', { name: 'Link copied' })).toBeTruthy()

    // Advance timers by 2000ms
    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(screen.getByRole('button', { name: 'Copy iCal subscription link' })).toBeTruthy()

    vi.useRealTimers()
  })

  it('Test 5 (settings integration smoke): SubscribeIcalItem heading visible when settings page renders', async () => {
    const { SettingsPage } = await import('../../routes/settings.js')
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
        mutations: { retry: false },
      },
    })

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <SettingsPage />
        </MemoryRouter>
      </QueryClientProvider>
    )

    expect(screen.getByText('Subscribe (iCal)')).toBeTruthy()
  })
})
