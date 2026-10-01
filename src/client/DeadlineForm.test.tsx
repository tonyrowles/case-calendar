// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { DeadlineForm } from './components/DeadlineForm.js'

// Mock the api module so DeadlineForm doesn't fire real fetch calls in tests
vi.mock('./lib/api.js', () => ({
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
  getCaseLabels: vi.fn().mockResolvedValue([]),
  getDeadlines: vi.fn().mockResolvedValue([]),
  createDeadline: vi.fn().mockResolvedValue({}),
}))

afterEach(() => cleanup())

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
}

describe('DeadlineForm', () => {
  it('all text inputs and textarea carry autocomplete="off"', async () => {
    renderWithQuery(<DeadlineForm />)
    // Case input
    const caseInput = screen.getByPlaceholderText('e.g. Smith v. Jones')
    expect(caseInput.getAttribute('autocomplete')).toBe('off')
    // Description textarea
    const descTextarea = screen.getByPlaceholderText('Hearing time, motion number, filing notes…')
    expect(descTextarea.getAttribute('autocomplete')).toBe('off')
  })

  it('form root carries autocomplete="off"', () => {
    const { container } = renderWithQuery(<DeadlineForm />)
    const form = container.querySelector('form')
    expect(form).not.toBeNull()
    expect(form!.getAttribute('autocomplete')).toBe('off')
  })

  it('renders Save Deadline button', () => {
    renderWithQuery(<DeadlineForm />)
    expect(screen.getByRole('button', { name: /save deadline/i })).toBeDefined()
  })

  it('renders Add Deadline heading', () => {
    renderWithQuery(<DeadlineForm />)
    expect(screen.getByText('Add Deadline')).toBeDefined()
  })

  it('selectedDate prop pre-fills the date trigger and focuses case-label input (02-04-02)', async () => {
    renderWithQuery(<DeadlineForm selectedDate="2026-07-04" />)
    // The date trigger button should display the formatted date after the useEffect fires.
    // We check by finding a button element whose text content contains the formatted date.
    await waitFor(() => {
      const dateTrigger = document.querySelector('#date-trigger')
      expect(dateTrigger).not.toBeNull()
      expect(dateTrigger!.textContent).toContain('July 4, 2026')
    })
    // The case-label input should have focus
    const caseLabelInput = screen.getByPlaceholderText('e.g. Smith v. Jones')
    expect(document.activeElement).toBe(caseLabelInput)
  })
})
