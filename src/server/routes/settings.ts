import fs from 'node:fs'
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { zValidator } from '@hono/zod-validator'
import { settingsUpdateSchema, type AppSettings } from '../../shared/schemas/settings.js'
import { DEFAULT_WALLPAPER_THEME, isWallpaperThemeId } from '../../shared/lib/wallpaper-themes.js'
import { getSetting, notifyWallpaperInputsChanged, setSetting } from '../queries.js'
import {
  MAX_BACKGROUND_BYTES,
  deleteBackground,
  detectImageType,
  getBackground,
  saveBackground,
} from '../lib/wallpaper-background.js'
import { type AppVariables } from '../middleware/user-context.js'
import { logger } from '../logger.js'

export const settingsRouter = new Hono<{ Variables: AppVariables }>()

function currentSettings(): AppSettings {
  const theme = getSetting('wallpaperTheme')
  const bg = getBackground()
  return {
    wallpaperTheme: isWallpaperThemeId(theme) ? theme : DEFAULT_WALLPAPER_THEME,
    wallpaperBackground: bg ? { version: bg.version } : null,
  }
}

const dbError = { error: { code: 'db_error', message: 'Database read failed.' } }

// GET /api/settings
settingsRouter.get('/settings', (c) => {
  try {
    return c.json(currentSettings())
  } catch (err) {
    logger.error({ err }, 'GET /settings failed')
    return c.json(dbError, 500)
  }
})

// PUT /api/settings { wallpaperTheme }
settingsRouter.put(
  '/settings',
  zValidator('json', settingsUpdateSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_failed', message: 'Unknown setting or value.' } }, 422)
    }
  }),
  (c) => {
    try {
      setSetting('wallpaperTheme', c.req.valid('json').wallpaperTheme)
      return c.json(currentSettings())
    } catch (err) {
      logger.error({ err }, 'PUT /settings failed')
      return c.json({ error: { code: 'db_error', message: "Couldn't save to database." } }, 500)
    }
  }
)

// GET /api/wallpaper-background -> the image bytes (404 when none)
settingsRouter.get('/wallpaper-background', (c) => {
  const bg = getBackground()
  if (!bg) return c.json({ error: { code: 'not_found', message: 'No background image.' } }, 404)
  // ?v=<version> in the URL busts caches; no-cache keeps a stale image from lingering
  return c.body(fs.readFileSync(bg.filePath), 200, {
    'Content-Type': bg.contentType,
    'Cache-Control': 'no-cache',
  })
})

// PUT /api/wallpaper-background  body = raw image bytes (JPEG, PNG or WebP, <= 25 MB)
settingsRouter.put(
  '/wallpaper-background',
  bodyLimit({
    maxSize: MAX_BACKGROUND_BYTES,
    onError: (c) => c.json({ error: { code: 'too_large', message: 'Image is larger than 25 MB.' } }, 413),
  }),
  async (c) => {
    const data = Buffer.from(await c.req.arrayBuffer())
    const type = detectImageType(data)
    if (!type) {
      return c.json({ error: { code: 'unsupported_type', message: 'Use a JPEG, PNG or WebP image.' } }, 415)
    }
    try {
      const version = saveBackground(data, type.ext)
      notifyWallpaperInputsChanged()
      return c.json({ version })
    } catch (err) {
      logger.error({ err }, 'PUT /wallpaper-background failed')
      return c.json({ error: { code: 'write_failed', message: "Couldn't save the image." } }, 500)
    }
  }
)

// DELETE /api/wallpaper-background -> 204 (back to the built-in gradient) | 404
settingsRouter.delete('/wallpaper-background', (c) => {
  try {
    if (!deleteBackground()) return c.json({ error: { code: 'not_found', message: 'No background image.' } }, 404)
    notifyWallpaperInputsChanged()
    return c.body(null, 204)
  } catch (err) {
    logger.error({ err }, 'DELETE /wallpaper-background failed')
    return c.json({ error: { code: 'write_failed', message: "Couldn't remove the image." } }, 500)
  }
})
