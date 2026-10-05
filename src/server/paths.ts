/**
 * Where user data lives. A developer checkout keeps everything in ./data and ./.env.local
 * (relative to the working directory). An installed copy sets CASE_CALENDAR_DATA (the tray
 * does, to %LOCALAPPDATA%\CaseCalendar) so data survives updates that replace the program
 * folder: the database, backups, wallpaper images and an optional .env.local all go there.
 */
import path from 'node:path'

const custom = process.env.CASE_CALENDAR_DATA?.trim()

/** Database, backups, wallpaper PNGs and the Glass background image. */
export const DATA_DIR = custom ? path.join(custom, 'data') : path.resolve('data')

/** Optional .env.local (Settings > Setup is the usual way to configure). */
export const ENV_FILE = custom ? path.join(custom, '.env.local') : path.resolve('.env.local')
