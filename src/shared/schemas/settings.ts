import { z } from 'zod'
import { WALLPAPER_THEME_IDS, type WallpaperThemeId } from '../lib/wallpaper-themes.js'
import { ICON_SIDES, type IconSide } from '../lib/wallpaper-layout.js'

/** GET /api/settings */
export interface AppSettings {
  wallpaperTheme: WallpaperThemeId
  /** The Glass theme's uploaded background image; version changes on every upload (cache-busting) */
  wallpaperBackground: { version: number } | null
  /** Which side of the screen to keep clear for desktop icons */
  wallpaperIconSide: IconSide
  /** Icon columns to keep clear; null = automatic for the screen width */
  wallpaperIconColumns: number | null
  /** Monitor to put the calendar on: 'primary' or a monitor id from /api/displays */
  wallpaperMonitor: string
}

/** PUT /api/settings: fields to change */
export const settingsUpdateSchema = z.object({
  wallpaperTheme: z.enum(WALLPAPER_THEME_IDS).optional(),
  wallpaperIconSide: z.enum(ICON_SIDES as [IconSide, ...IconSide[]]).optional(),
  wallpaperIconColumns: z.number().int().min(0).max(12).nullable().optional(),
  wallpaperMonitor: z.string().trim().min(1).max(500).optional(),
}).strict().refine(v => Object.keys(v).length > 0, 'Nothing to update')

export type SettingsUpdate = z.infer<typeof settingsUpdateSchema>
