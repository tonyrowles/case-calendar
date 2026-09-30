import { z } from 'zod'
import { WALLPAPER_THEME_IDS, type WallpaperThemeId } from '../lib/wallpaper-themes.js'

/** GET /api/settings */
export interface AppSettings {
  wallpaperTheme: WallpaperThemeId
  /** The Glass theme's uploaded background image; version changes on every upload (cache-busting) */
  wallpaperBackground: { version: number } | null
}

/** PUT /api/settings: fields to change */
export const settingsUpdateSchema = z.object({
  wallpaperTheme: z.enum(WALLPAPER_THEME_IDS),
}).strict()

export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>
