/**
 * Background services (wallpaper, email digest, email import): started at boot, and
 * restarted when Settings > Setup changes something they depend on, so new settings
 * apply without restarting the server.
 */
import { logger } from './logger.js'
import { notifyWallpaperInputsChanged } from './queries.js'
import type { ConfigKey } from './lib/config.js'
import { startWallpaperWorker, stopWallpaperWorker, wallpaperWorkerRunning } from './workers/wallpaper.js'
import { restartEmailWorker, startEmailWorker } from './workers/email.js'
import { restartEmailImportWorker, startEmailImportWorker } from './workers/email-import.js'

export function startServices(): void {
  if (process.env.WALLPAPER_ENABLED === 'true') {
    startWallpaperWorker()   // WALL-01/02/04/05: fire-and-forget; non-blocking
  } else {
    logger.info('wallpaper disabled (turn it on in Settings > Setup)')
  }
  startEmailImportWorker() // email-to-inbox import; no-op unless enabled
  void startEmailWorker()  // EMAIL-01/02/03: async; no-op when unconfigured; never blocks server boot
}

const ACCOUNT: ConfigKey[] = ['SMTP_USER', 'SMTP_PASS']
const DIGEST: ConfigKey[] = [...ACCOUNT, 'SMTP_HOST', 'SMTP_PORT', 'EMAIL_DIGEST_ENABLED', 'SMTP_TO', 'SMTP_FROM', 'TZ']
const IMPORT: ConfigKey[] = [...ACCOUNT, 'IMAP_HOST', 'IMAP_PORT', 'EMAIL_IMPORT_ENABLED', 'EMAIL_IMPORT_ADDRESS', 'EMAIL_IMPORT_ALLOWED_SENDERS']

/** Restart whatever depends on the changed settings. AI keys need nothing: they are read per call. */
export async function applyConfigChanges(changed: ConfigKey[]): Promise<void> {
  const touches = (keys: ConfigKey[]) => changed.some(k => keys.includes(k))
  if (changed.includes('WALLPAPER_ENABLED')) {
    if (process.env.WALLPAPER_ENABLED === 'true') {
      if (!wallpaperWorkerRunning()) startWallpaperWorker()
    } else {
      await stopWallpaperWorker()
    }
  }
  // A new time zone can move "today": redraw the wallpaper
  if (changed.includes('TZ')) notifyWallpaperInputsChanged()
  if (touches(IMPORT)) restartEmailImportWorker()
  if (touches(DIGEST)) await restartEmailWorker()
}
