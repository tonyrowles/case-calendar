// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { AppSettings } from '@/shared/schemas/settings.js'
import { WallpaperSettings } from './WallpaperSettings.js'

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
  updateSettings: vi.fn().mockResolvedValue({ wallpaperTheme: 'dark', wallpaperBackground: null }),
  uploadWallpaperBackground: vi.fn().mockResolvedValue({ version: 2 }),
  deleteWallpaperBackground: vi.fn().mockResolvedValue(undefined),
  wallpaperBackgroundUrl: (v: number) => `/api/wallpaper-background?v=${v}`,
}))
import { deleteWallpaperBackground, updateSettings, uploadWallpaperBackground } from '@/client/lib/api.js'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderSettings(partial: Omit<AppSettings, 'wallpaperIconSide' | 'wallpaperIconColumns' | 'wallpaperMonitor'> & Partial<AppSettings>) {
  const settings: AppSettings = { ...{ wallpaperIconSide: 'left' as const, wallpaperIconColumns: null, wallpaperMonitor: 'primary' }, ...partial }
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  qc.setQueryData(['settings'], settings)
  return render(
    <QueryClientProvider client={qc}>
      <WallpaperSettings />
    </QueryClientProvider>
  )
}

describe('WallpaperSettings (Settings > Wallpaper)', () => {
  it('shows the three themes with the saved one checked', () => {
    renderSettings({ wallpaperTheme: 'glass', wallpaperBackground: null })
    const radios = screen.getAllByRole('radio')
    expect(radios.map(r => r.textContent?.match(/Light|Dark|Glass/)?.[0])).toEqual(['Light', 'Dark', 'Glass'])
    expect(screen.getByRole('radio', { checked: true }).textContent).toContain('Glass')
  })

  it('choosing a theme saves it', async () => {
    renderSettings({ wallpaperTheme: 'light', wallpaperBackground: null })
    fireEvent.click(screen.getAllByRole('radio').find(r => r.textContent?.includes('Dark'))!)
    await waitFor(() => expect(updateSettings).toHaveBeenCalledWith({ wallpaperTheme: 'dark' }))
  })

  it('uploading a file sends it; no Remove button until an image exists', async () => {
    renderSettings({ wallpaperTheme: 'glass', wallpaperBackground: null })
    expect(screen.queryByRole('button', { name: /remove/i })).toBeNull()
    const file = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'photo.jpg', { type: 'image/jpeg' })
    fireEvent.change(screen.getByLabelText('Choose background image'), { target: { files: [file] } })
    await waitFor(() => expect(uploadWallpaperBackground).toHaveBeenCalled())
    expect(vi.mocked(uploadWallpaperBackground).mock.calls[0][0]).toBe(file)
  })

  it('with an image: shows a thumbnail, "Replace image", and Remove deletes it', async () => {
    renderSettings({ wallpaperTheme: 'glass', wallpaperBackground: { version: 7 } })
    expect((screen.getByAltText('Current Glass background') as HTMLImageElement).getAttribute('src'))
      .toBe('/api/wallpaper-background?v=7')
    expect(screen.getByRole('button', { name: /replace image/i })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /remove/i }))
    await waitFor(() => expect(deleteWallpaperBackground).toHaveBeenCalled())
  })
})
