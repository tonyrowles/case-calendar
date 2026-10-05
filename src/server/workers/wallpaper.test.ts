/**
 * Wallpaper worker tests — WALL-01, WALL-02, WALL-04, WALL-05
 *
 * Mock structure: playwright and node-cron are both vi.mock'd at the top.
 * All tests use vi.useFakeTimers() / vi.useRealTimers() per beforeEach/afterEach.
 * Module-level state is reset via wp.__resetForTests() in beforeEach.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// --- Mocks (must be at top of file, before imports of modules under test) ---

vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn().mockReturnValue({
      stop: vi.fn(),
      destroy: vi.fn(),
      execute: vi.fn(),
    }),
  },
}))

vi.mock('playwright-core', () => {
  const page = {
    goto: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    screenshot: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  }
  const context = {
    newPage: vi.fn().mockResolvedValue(page),
    close: vi.fn().mockResolvedValue(undefined),
  }
  const browser = {
    newContext: vi.fn().mockResolvedValue(context),
    close: vi.fn().mockResolvedValue(undefined),
  }
  return { chromium: { launch: vi.fn().mockResolvedValue(browser) } }
})

// Mock the queries module to avoid DB dependency
vi.mock('../queries.js', () => ({
  onMutation: vi.fn(),
  getSetting: vi.fn().mockReturnValue(null),
}))

// Mock spawn-apply so tests that call setApplyWallpaper(spawnPowerShellApply) inside
// startWallpaperWorker don't pick up the real spawn impl. Tests override the apply
// function directly via wp.setApplyWallpaper(vi.fn()) when needed.
vi.mock('./spawn-apply.js', () => ({
  spawnPowerShellApply: vi.fn().mockResolvedValue(undefined),
  buildPowerShellArgs: vi.fn(() => []),
  __setSpawnForTests: vi.fn(),
  __resetSpawnForTests: vi.fn(),
}))

// Mock logger to suppress output in tests
vi.mock('../logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock fs/promises so pruneOldWallpapers doesn't hit the real filesystem
vi.mock('node:fs/promises', () => ({
  readdir: vi.fn().mockResolvedValue([]),
  stat: vi.fn().mockResolvedValue({ mtime: new Date() }),
  unlink: vi.fn().mockResolvedValue(undefined),
}))

import * as wp from './wallpaper.js'
import { chromium } from 'playwright-core'
import cron from 'node-cron'
import { onMutation } from '../queries.js'
import { logger } from '../logger.js'
import { readdir, stat, unlink } from 'node:fs/promises'

// Helper to get the mock page (re-extracted from the mocked chromium chain)
async function getMockBrowser() {
  const browser = await (chromium.launch as ReturnType<typeof vi.fn>).mock.results[0]?.value
  return browser
}

async function getMockContext() {
  const browser = await getMockBrowser()
  const context = await browser?.newContext.mock.results[0]?.value
  return context
}

async function getMockPage() {
  const context = await getMockContext()
  const page = await context?.newPage.mock.results[0]?.value
  return page
}

// Helper to create dummy wallpaper PNG files in a temp dir with staggered mtimes
function makeDummyWallpaperFiles(dir: string, count: number): string[] {
  const files: string[] = []
  for (let i = 0; i < count; i++) {
    const ts = new Date(Date.now() - i * 60_000) // each 1 minute older
    const isoTs = ts.toISOString().replace(/:/g, '-').replace(/\.\d{3}/, '')
    const filename = `wallpaper-${isoTs}.png`
    const fullPath = path.join(dir, filename)
    fs.writeFileSync(fullPath, '')
    fs.utimesSync(fullPath, ts, ts)
    files.push(filename)
  }
  return files
}

beforeEach(() => {
  vi.useFakeTimers()
  wp.__resetForTests()
  vi.clearAllMocks()
  // Re-establish default mock return values after clearAllMocks
  ;(cron.schedule as ReturnType<typeof vi.fn>).mockReturnValue({
    stop: vi.fn(),
    destroy: vi.fn(),
    execute: vi.fn(),
  })
  const page = {
    goto: vi.fn().mockResolvedValue(undefined),
    waitForTimeout: vi.fn().mockResolvedValue(undefined),
    screenshot: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  }
  const context = {
    newPage: vi.fn().mockResolvedValue(page),
    close: vi.fn().mockResolvedValue(undefined),
  }
  const browser = {
    newContext: vi.fn().mockResolvedValue(context),
    close: vi.fn().mockResolvedValue(undefined),
  }
  ;(chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue(browser)
  ;(readdir as ReturnType<typeof vi.fn>).mockResolvedValue([])
  ;(stat as ReturnType<typeof vi.fn>).mockResolvedValue({ mtime: new Date() })
  ;(unlink as ReturnType<typeof vi.fn>).mockResolvedValue(undefined)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

// --- WALL-01: Playwright screenshot integration ---

describe('WALL-01: Playwright screenshot integration', () => {
  it('T1: chromium.launch called with headless:true and required args', async () => {
    await wp.generateAndApplyWallpaper()

    expect(chromium.launch).toHaveBeenCalledWith(
      expect.objectContaining({
        headless: true,
        args: expect.arrayContaining(['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu']),
      })
    )
  })

  it('T2: browser.newContext called with correct viewport and deviceScaleFactor', async () => {
    await wp.generateAndApplyWallpaper()

    const browser = (chromium.launch as ReturnType<typeof vi.fn>).mock.results[0]?.value
    expect(browser).toBeDefined()
    const resolvedBrowser = await browser
    expect(resolvedBrowser.newContext).toHaveBeenCalledWith(
      expect.objectContaining({
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1,
      })
    )
  })

  it('T3: page.goto called with correct URL pattern and networkidle waitUntil', async () => {
    await wp.generateAndApplyWallpaper()

    const browser = await (chromium.launch as ReturnType<typeof vi.fn>).mock.results[0]?.value
    const context = await browser.newContext.mock.results[0]?.value
    const page = await context.newPage.mock.results[0]?.value

    expect(page.goto).toHaveBeenCalledWith(
      expect.stringMatching(/^http:\/\/127\.0\.0\.1:3747\/wallpaper\?w=\d+&h=\d+&t=\d+$/),
      expect.objectContaining({ waitUntil: 'networkidle' })
    )
  })

  it('T4: page.waitForTimeout(200) is called before page.screenshot', async () => {
    await wp.generateAndApplyWallpaper()

    const browser = await (chromium.launch as ReturnType<typeof vi.fn>).mock.results[0]?.value
    const context = await browser.newContext.mock.results[0]?.value
    const page = await context.newPage.mock.results[0]?.value

    expect(page.waitForTimeout).toHaveBeenCalledWith(200)

    const waitForTimeoutOrder = page.waitForTimeout.mock.invocationCallOrder[0]
    const screenshotOrder = page.screenshot.mock.invocationCallOrder[0]
    expect(waitForTimeoutOrder).toBeLessThan(screenshotOrder)
  })
})

// --- WALL-02: Filename + retention ---

describe('WALL-02: Filename + retention', () => {
  it('T5: generated PNG filename matches safe timestamp format (no colons)', async () => {
    let capturedPath = ''
    const browser = await (chromium.launch as ReturnType<typeof vi.fn>).mock.results[0]?.value
    // We need to intercept the screenshot path; patch screenshot to capture path
    ;(chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue({
      newContext: vi.fn().mockResolvedValue({
        newPage: vi.fn().mockResolvedValue({
          goto: vi.fn().mockResolvedValue(undefined),
          waitForTimeout: vi.fn().mockResolvedValue(undefined),
          screenshot: vi.fn().mockImplementation(({ path: p }: { path: string }) => {
            capturedPath = p
            return Promise.resolve(undefined)
          }),
          close: vi.fn().mockResolvedValue(undefined),
        }),
        close: vi.fn().mockResolvedValue(undefined),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    })

    await wp.generateAndApplyWallpaper()

    // The path should match wallpaper-YYYY-MM-DDTHH-mm-ssZ.png
    expect(capturedPath).toMatch(/^.*[/\\]wallpaper-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}Z\.png$/)
    // Explicit: no colons in the filename portion
    const filename = path.basename(capturedPath)
    expect(filename).not.toContain(':')
  })

  it('T6: retention prune keeps only the 10 newest wallpaper-*.png files', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wallpaper-test-'))

    try {
      // Create 15 dummy files with staggered mtimes
      const files = makeDummyWallpaperFiles(tmpDir, 15)

      // Mock readdir to return these files and stat to return real mtimes
      ;(readdir as ReturnType<typeof vi.fn>).mockResolvedValue(files)
      ;(stat as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        const filename = path.basename(filePath)
        const fullPath = path.join(tmpDir, filename)
        try {
          return Promise.resolve(fs.statSync(fullPath))
        } catch {
          return Promise.resolve({ mtime: new Date(0) })
        }
      })

      const deletedFiles: string[] = []
      ;(unlink as ReturnType<typeof vi.fn>).mockImplementation((filePath: string) => {
        deletedFiles.push(path.basename(filePath))
        return Promise.resolve(undefined)
      })

      await wp.generateAndApplyWallpaper()

      // Should have called unlink for (15 - 10) = 5 oldest files
      expect(deletedFiles).toHaveLength(5)
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})

// --- WALL-03: cross-platform guard ---

describe('WALL-03: cross-platform guard', () => {
  it('T7: on non-Windows platform, applyWallpaperImpl is NOT called after screenshot', async () => {
    // Stub platform as non-win32
    vi.stubGlobal('process', { ...process, platform: 'linux' })

    const applyFn = vi.fn().mockResolvedValue(undefined)
    wp.setApplyWallpaper(applyFn)

    await wp.generateAndApplyWallpaper()

    expect(applyFn).not.toHaveBeenCalled()

    // Restore
    vi.stubGlobal('process', process)
  })

  it('T8: on Windows platform, applyWallpaperImpl IS called with absolute PNG path', async () => {
    vi.stubGlobal('process', { ...process, platform: 'win32' })

    const applyFn = vi.fn().mockResolvedValue(undefined)
    wp.setApplyWallpaper(applyFn)

    await wp.generateAndApplyWallpaper()

    expect(applyFn).toHaveBeenCalledOnce()
    // Should be called with an absolute path ending in .png
    const calledWith = applyFn.mock.calls[0][0] as string
    expect(path.isAbsolute(calledWith)).toBe(true)
    expect(calledWith).toMatch(/wallpaper-.*\.png$/)

    // Restore
    vi.stubGlobal('process', process)
  })
})

// --- WALL-04: cron schedule ---

describe('WALL-04: cron schedule', () => {
  it('T9: cron.schedule called with "*/30 * * * *" (string equality)', () => {
    wp.startWallpaperWorker()

    expect(cron.schedule).toHaveBeenCalledWith(
      '*/30 * * * *',
      expect.any(Function),
      expect.any(Object)
    )
  })

  it('T10: cron.schedule options include timezone and noOverlap:true', () => {
    wp.startWallpaperWorker()

    const call = (cron.schedule as ReturnType<typeof vi.fn>).mock.calls[0]
    const opts = call[2] as { timezone?: string; noOverlap?: boolean }
    expect(typeof opts.timezone).toBe('string')
    expect(opts.noOverlap).toBe(true)
  })
})

// --- WALL-05: trailing-edge debounce ---

describe('WALL-05: trailing-edge debounce', () => {
  it('T11: 3 rapid triggerDebouncedScreenshot() calls → 0 screenshots before 10s, 1 after', async () => {
    // Track generateAndApplyWallpaper invocations by spying on page.screenshot calls
    // We intercept at the launchBrowser level: pre-launch the browser mock
    const screenshotMock = vi.fn().mockResolvedValue(undefined)
    ;(chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue({
      newContext: vi.fn().mockResolvedValue({
        newPage: vi.fn().mockResolvedValue({
          goto: vi.fn().mockResolvedValue(undefined),
          waitForTimeout: vi.fn().mockResolvedValue(undefined),
          screenshot: screenshotMock,
          close: vi.fn().mockResolvedValue(undefined),
        }),
        close: vi.fn().mockResolvedValue(undefined),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    })

    // Call 3 times rapidly
    wp.triggerDebouncedScreenshot()
    await vi.advanceTimersByTimeAsync(1_000)
    wp.triggerDebouncedScreenshot()
    await vi.advanceTimersByTimeAsync(2_000)
    wp.triggerDebouncedScreenshot()
    await vi.advanceTimersByTimeAsync(1_000)

    // Before 10s debounce expires: no screenshot
    expect(screenshotMock).not.toHaveBeenCalled()

    // Advance past debounce window
    await vi.advanceTimersByTimeAsync(10_000)

    // Exactly 1 screenshot
    expect(screenshotMock).toHaveBeenCalledOnce()
  })

  it('T11b: startWallpaperWorker renders once at startup (no 30-min wait after a restart)', async () => {
    const screenshotMock = vi.fn().mockResolvedValue(undefined)
    ;(chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue({
      newContext: vi.fn().mockResolvedValue({
        newPage: vi.fn().mockResolvedValue({
          goto: vi.fn().mockResolvedValue(undefined),
          waitForTimeout: vi.fn().mockResolvedValue(undefined),
          screenshot: screenshotMock,
          close: vi.fn().mockResolvedValue(undefined),
        }),
        close: vi.fn().mockResolvedValue(undefined),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    })

    wp.startWallpaperWorker()
    await vi.advanceTimersByTimeAsync(0)

    expect(screenshotMock).toHaveBeenCalledOnce()
  })

  it('T12: startWallpaperWorker registers a subscriber via onMutation', () => {
    wp.startWallpaperWorker()

    expect(onMutation).toHaveBeenCalledOnce()
    expect(onMutation).toHaveBeenCalledWith(expect.any(Function))
  })

  it('T13: after timer fires, debounceTimer is reset and a subsequent trigger starts fresh 10s window', async () => {
    const screenshotMock = vi.fn().mockResolvedValue(undefined)
    ;(chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue({
      newContext: vi.fn().mockResolvedValue({
        newPage: vi.fn().mockResolvedValue({
          goto: vi.fn().mockResolvedValue(undefined),
          waitForTimeout: vi.fn().mockResolvedValue(undefined),
          screenshot: screenshotMock,
          close: vi.fn().mockResolvedValue(undefined),
        }),
        close: vi.fn().mockResolvedValue(undefined),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    })

    // First debounce window: fire after 10s
    wp.triggerDebouncedScreenshot()
    await vi.advanceTimersByTimeAsync(10_000)
    expect(screenshotMock).toHaveBeenCalledOnce()

    // Start second debounce window
    wp.triggerDebouncedScreenshot()
    // Advance 9.9s — should NOT fire
    await vi.advanceTimersByTimeAsync(9_900)
    expect(screenshotMock).toHaveBeenCalledOnce() // still just 1

    // Advance remaining 0.1s — should fire
    await vi.advanceTimersByTimeAsync(100)
    expect(screenshotMock).toHaveBeenCalledTimes(2)
  })
})

// --- WALL-05/WALL-03: concurrency + crash safety ---

describe('WALL-05/WALL-03: concurrency + crash safety', () => {
  it('T14: while generateAndApplyWallpaper is in-flight, second call returns without second screenshot', async () => {
    let resolveScreenshot!: () => void
    const screenshotMock = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => { resolveScreenshot = resolve })
    )
    ;(chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue({
      newContext: vi.fn().mockResolvedValue({
        newPage: vi.fn().mockResolvedValue({
          goto: vi.fn().mockResolvedValue(undefined),
          waitForTimeout: vi.fn().mockResolvedValue(undefined),
          screenshot: screenshotMock,
          close: vi.fn().mockResolvedValue(undefined),
        }),
        close: vi.fn().mockResolvedValue(undefined),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    })

    // First call — keeps screenshot pending indefinitely
    const firstCall = wp.generateAndApplyWallpaper()

    // Allow the full async chain to reach the screenshot call (many micro-task flushes)
    // launchBrowser -> context -> page -> goto -> waitForTimeout -> screenshot (pending)
    for (let i = 0; i < 20; i++) {
      await Promise.resolve()
    }

    // At this point isGenerating=true and screenshotMock is being awaited
    // Second call — should see isGenerating=true and return immediately
    await wp.generateAndApplyWallpaper()

    // Still only 1 screenshot call (first in-flight)
    expect(screenshotMock).toHaveBeenCalledOnce()

    // Resolve the first screenshot and let it finish
    resolveScreenshot()
    await firstCall
  })

  it('T15: when applyWallpaperImpl rejects, error is logged at warn and isGenerating resets to false', async () => {
    vi.stubGlobal('process', { ...process, platform: 'win32' })

    // Track screenshot calls from the beforeEach mock context
    const screenshotMock = vi.fn().mockResolvedValue(undefined)
    ;(chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue({
      newContext: vi.fn().mockResolvedValue({
        newPage: vi.fn().mockResolvedValue({
          goto: vi.fn().mockResolvedValue(undefined),
          waitForTimeout: vi.fn().mockResolvedValue(undefined),
          screenshot: screenshotMock,
          close: vi.fn().mockResolvedValue(undefined),
        }),
        close: vi.fn().mockResolvedValue(undefined),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    })

    const applyFn = vi.fn().mockRejectedValue(new Error('PS1 failed'))
    wp.setApplyWallpaper(applyFn)

    // Should not throw
    await expect(wp.generateAndApplyWallpaper()).resolves.toBeUndefined()

    // Error should be logged at warn
    expect(logger.warn).toHaveBeenCalled()
    // First call took a screenshot
    expect(screenshotMock).toHaveBeenCalledOnce()

    // isGenerating should be reset — second call can proceed (takes another screenshot)
    await wp.generateAndApplyWallpaper()
    expect(screenshotMock).toHaveBeenCalledTimes(2)

    vi.stubGlobal('process', process)
  })
})

// --- Per-screenshot lifecycle ---

describe('Per-screenshot lifecycle', () => {
  it('T16: page.close() is called in finally even if screenshot rejects', async () => {
    let pageMock: {
      goto: ReturnType<typeof vi.fn>
      waitForTimeout: ReturnType<typeof vi.fn>
      screenshot: ReturnType<typeof vi.fn>
      close: ReturnType<typeof vi.fn>
    }

    pageMock = {
      goto: vi.fn().mockResolvedValue(undefined),
      waitForTimeout: vi.fn().mockResolvedValue(undefined),
      screenshot: vi.fn().mockRejectedValue(new Error('screenshot failed')),
      close: vi.fn().mockResolvedValue(undefined),
    }
    ;(chromium.launch as ReturnType<typeof vi.fn>).mockResolvedValue({
      newContext: vi.fn().mockResolvedValue({
        newPage: vi.fn().mockResolvedValue(pageMock),
        close: vi.fn().mockResolvedValue(undefined),
      }),
      close: vi.fn().mockResolvedValue(undefined),
    })

    // generateAndApplyWallpaper should not throw — it logs and swallows the error
    await expect(wp.generateAndApplyWallpaper()).resolves.toBeUndefined()

    // page.close() must still have been called (finally block)
    expect(pageMock.close).toHaveBeenCalledOnce()
  })
})
