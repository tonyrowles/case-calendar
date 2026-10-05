/**
 * HOOK-02 (Phase 9): Wallpaper worker — Playwright screenshot generation,
 * node-cron scheduling, trailing-edge debounce on mutation, and retention pruning.
 *
 * Covers: WALL-01 (browser lifecycle), WALL-02 (filename + retention),
 *         WALL-04 (cron schedule), WALL-05 (debounce + mutation hook).
 *
 * Plan 03 wires the PowerShell apply callback via setApplyWallpaper().
 */
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdir, stat, unlink } from 'node:fs/promises'
import cron, { type ScheduledTask } from 'node-cron'
import { chromium, type Browser, type BrowserContext } from 'playwright'
import { logger } from '../logger.js'
import { getSetting, onMutation } from '../queries.js'
import { spawnPowerShellApply } from './spawn-apply.js'
import { FALLBACK_TARGET, listMonitors, pickTarget, type WallpaperTarget } from './monitors.js'

// --- Constants ---

const DEBOUNCE_MS = 10_000
/** SAFE-07: explicit loopback — never 0.0.0.0; bypasses Tailscale CORS checks */
const WALLPAPER_URL_BASE = 'http://127.0.0.1:3747/wallpaper'
const KEEP_COUNT = 10
const CRON_EXPR = '*/30 * * * *'
/** FullCalendar paint settle (Pitfall 2) */
const SETTLE_MS = 200
export const DATA_DIR = path.resolve('data')

// --- Dependency-injection seam (Plan 03 overrides via setApplyWallpaper) ---

/** monitorId: apply to that monitor only; null = every monitor */
export type ApplyWallpaperFn = (absolutePath: string, monitorId: string | null) => Promise<void>

// Module-level apply callback; default no-op; Plan 03 replaces at startup
let applyWallpaperImpl: ApplyWallpaperFn = async () => {
  /* default: no-op; Plan 03 will call setApplyWallpaper(spawnPowerShellApply) */
}

export function setApplyWallpaper(fn: ApplyWallpaperFn): void {
  applyWallpaperImpl = fn
}

// --- Module-level state (all reset by __resetForTests) ---

let browser: Browser | null = null
let context: BrowserContext | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let cronTask: ScheduledTask | null = null
let isGenerating = false

// --- Helper: build a Windows-safe timestamp filename ---

function buildTimestampFilename(): string {
  // SAFE-03: new Date() with NO arg is allowed; output manipulated via string replace only
  // Yields e.g. "2026-05-24T14-30-45Z" — no colons, NTFS-safe (Pitfall 4)
  return new Date().toISOString().replace(/:/g, '-').replace(/\.\d{3}/, '')
}

// --- Helper: build the wallpaper URL with cache-bust param ---

function buildWallpaperUrl(target: WallpaperTarget): string {
  return `${WALLPAPER_URL_BASE}?w=${target.logicalWidth}&h=${target.logicalHeight}&t=${Date.now()}`
}

/** The monitor to render for (Settings > Wallpaper > monitor; default primary). */
async function currentTarget(): Promise<WallpaperTarget> {
  const chosen = getSetting('wallpaperMonitor') || 'primary'
  return pickTarget(await listMonitors(), chosen)
}

let contextKey = ''
function targetKey(t: WallpaperTarget): string {
  return `${t.logicalWidth}x${t.logicalHeight}@${t.deviceScaleFactor}`
}
/** (Re)create the browser context when the target size or scaling changes. */
async function ensureContext(target: WallpaperTarget): Promise<void> {
  const key = targetKey(target)
  if (context !== null && key === contextKey) return
  if (browser === null) await launchBrowser()
  await context?.close().catch(() => {})
  context = await browser!.newContext({
    viewport: { width: target.logicalWidth, height: target.logicalHeight },
    deviceScaleFactor: target.deviceScaleFactor,
  })
  contextKey = key
}

// --- Browser lifecycle ---

async function launchBrowser(): Promise<void> {
  browser = await chromium.launch({
    headless: true,
    // Pitfall 5+6: --no-sandbox required for service-account / restricted contexts;
    // acceptable because browser only loads loopback 127.0.0.1:3747/wallpaper
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  })
  context = await browser.newContext({
    viewport: { width: FALLBACK_TARGET.logicalWidth, height: FALLBACK_TARGET.logicalHeight },
    deviceScaleFactor: FALLBACK_TARGET.deviceScaleFactor,
  })
  contextKey = targetKey(FALLBACK_TARGET)
}

async function closeBrowser(): Promise<void> {
  await context?.close()
  await browser?.close()
  context = null
  browser = null
}

// --- Screenshot helper ---

async function takeScreenshot(url: string, outputPath: string): Promise<void> {
  if (context === null) {
    throw new Error('wallpaper: BrowserContext is null — launchBrowser() must be called first')
  }
  const page = await context.newPage()
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 })
    await page.waitForTimeout(SETTLE_MS)
    await page.screenshot({ path: outputPath })
  } finally {
    await page.close()
  }
}

// --- Retention pruning ---

async function pruneOldWallpapers(): Promise<void> {
  const files = (await readdir(DATA_DIR)).filter(
    (f) => f.startsWith('wallpaper-') && f.endsWith('.png')
  )
  if (files.length <= KEEP_COUNT) return

  const withMtime = await Promise.all(
    files.map(async (f) => ({
      file: f,
      mtime: (await stat(path.join(DATA_DIR, f))).mtime.getTime(),
    }))
  )

  // Sort newest-first
  withMtime.sort((a, b) => b.mtime - a.mtime)

  const toDelete = withMtime.slice(KEEP_COUNT)
  await Promise.all(
    toDelete.map(({ file }) =>
      unlink(path.join(DATA_DIR, file)).catch((err) =>
        logger.warn({ err, file }, 'wallpaper: failed to prune old PNG — skipping')
      )
    )
  )

  if (toDelete.length > 0) {
    logger.info({ kept: KEEP_COUNT, removed: toDelete.length }, 'wallpaper: pruned old PNGs')
  }
}

// --- Core generation function ---

export async function generateAndApplyWallpaper(): Promise<void> {
  // Concurrency guard (Pitfall 3)
  if (isGenerating) {
    logger.info('wallpaper: generation already in flight; skipping')
    return
  }
  isGenerating = true

  try {
    // Cold-path safety: launch browser if not already running
    // (primary path is startWallpaperWorker having already launched it)
    if (browser === null || context === null) {
      await launchBrowser()
    }

    const filename = `wallpaper-${buildTimestampFilename()}.png`
    const absolutePath = path.join(DATA_DIR, filename)

    const target = await currentTarget()
    await ensureContext(target)
    const wallpaperUrl = buildWallpaperUrl(target)
    logger.info(
      { url: wallpaperUrl, path: absolutePath, monitorId: target.monitorId, scale: target.deviceScaleFactor },
      'wallpaper: generating screenshot'
    )

    await takeScreenshot(wallpaperUrl, absolutePath)
    await pruneOldWallpapers()

    if (process.platform === 'win32') {
      try {
        await applyWallpaperImpl(absolutePath, target.monitorId)
      } catch (err) {
        logger.warn(
          { err, path: absolutePath },
          'wallpaper: apply failed — will retry on next tick'
        )
      }
    } else {
      logger.info({ platform: process.platform }, 'wallpaper apply skipped (non-Windows)')
    }
  } catch (err) {
    // Worker MUST NOT crash the Hono server (Pitfall 7 + CONTEXT.md)
    logger.error({ err }, 'wallpaper: screenshot failed — will retry on next tick')
  } finally {
    isGenerating = false
  }
}

// --- Trailing-edge debounce trigger (WALL-05) ---

export function triggerDebouncedScreenshot(): void {
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = setTimeout(async () => {
    debounceTimer = null
    await generateAndApplyWallpaper()
  }, DEBOUNCE_MS)
}

// --- Entry point: start the background worker ---

export function startWallpaperWorker(): void {
  // Wire apply impl unconditionally — needed in both --once and normal paths.
  // Not gated by platform — generateAndApplyWallpaper guards process.platform === 'win32'
  // before calling applyWallpaperImpl, so spawnPowerShellApply is set unconditionally.
  setApplyWallpaper(spawnPowerShellApply)

  // --once mode: fire one screenshot and exit (server must be running on 3747)
  if (process.argv.includes('--once')) {
    ;(async () => {
      await launchBrowser()
      await generateAndApplyWallpaper()
      await closeBrowser()
      process.exit(0)
    })()
    return
  }

  // Launch persistent browser, then render once so a (re)started server refreshes the
  // wallpaper immediately instead of waiting up to 30 min for the first cron tick.
  // Called from serve()'s listening callback, so /wallpaper is already reachable.
  launchBrowser()
    .then(() => generateAndApplyWallpaper())
    .catch((err) => logger.error({ err }, 'wallpaper: browser launch failed at startup'))

  // Register 30-minute cron task (WALL-04)
  cronTask = cron.schedule(
    CRON_EXPR,
    () => {
      generateAndApplyWallpaper().catch((err) =>
        logger.error({ err }, 'wallpaper: cron callback rejected')
      )
    },
    {
      timezone: process.env.TZ ?? 'America/Los_Angeles',
      noOverlap: true,
      name: 'wallpaper-cron',
    }
  )

  // Subscribe to HOOK-04 mutation events (WALL-05); single-subscriber slot
  onMutation(triggerDebouncedScreenshot)

  // SIGTERM/SIGINT handlers — close browser gracefully before exit
  process.once('SIGTERM', () => {
    cronTask?.stop()
    closeBrowser()
      .then(() => process.exit(0))
      .catch(() => process.exit(1))
  })
  process.once('SIGINT', () => {
    cronTask?.stop()
    closeBrowser()
      .then(() => process.exit(0))
      .catch(() => process.exit(1))
  })

  logger.info(
    { schedule: CRON_EXPR, debounceMs: DEBOUNCE_MS, dpr: 1, viewport: '7680x2160' },
    'wallpaper worker started'
  )
}

// --- Module entry-point guard (for `npm run wallpaper:once` via tsx) ---

// When wallpaper.ts is run directly (tsx src/server/workers/wallpaper.ts --once),
// import.meta.url resolves to this file's path which matches process.argv[1].
// Without this guard, tsx exits immediately after evaluating the module without
// ever calling startWallpaperWorker(), so --once would do nothing.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  startWallpaperWorker()
}

// --- Test reset helper (VITEST only) ---

export function __resetForTests(): void {
  if (cronTask) {
    cronTask.destroy()
    cronTask = null
  }
  if (debounceTimer !== null) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  // Reset module state to initial values
  browser = null
  context = null
  isGenerating = false
  // Reset apply callback to default no-op
  applyWallpaperImpl = async () => { /* reset to default no-op */ }
}
