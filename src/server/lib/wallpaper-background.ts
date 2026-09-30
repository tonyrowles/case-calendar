import fs from 'node:fs'
import path from 'node:path'

// The Glass wallpaper theme's optional background image: one file in data/ (gitignored,
// stays on this machine). Tests use a per-worker scratch dir under data/backups-test/,
// which the global teardown deletes.
const IS_TEST = process.env.VITEST === 'true'
const DIR = IS_TEST
  ? path.join(process.cwd(), 'data', 'backups-test', process.env.VITEST_POOL_ID || 'main', 'wallpaper-bg')
  : path.join(process.cwd(), 'data')
const BASENAME = 'wallpaper-background'

export const MAX_BACKGROUND_BYTES = 25 * 1024 * 1024

const TYPES = [
  { ext: 'png', contentType: 'image/png', matches: (b: Buffer) => b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { ext: 'jpg', contentType: 'image/jpeg', matches: (b: Buffer) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { ext: 'webp', contentType: 'image/webp', matches: (b: Buffer) => b.length > 12 && b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP' },
] as const

/** The image type of `data` by its magic bytes (the Content-Type header is not trusted). */
export function detectImageType(data: Buffer): (typeof TYPES)[number] | null {
  return TYPES.find(t => t.matches(data)) ?? null
}

function existingFiles(): string[] {
  if (!fs.existsSync(DIR)) return []
  return TYPES.map(t => path.join(DIR, `${BASENAME}.${t.ext}`)).filter(p => fs.existsSync(p))
}

export interface BackgroundInfo { filePath: string; contentType: string; version: number }

export function getBackground(): BackgroundInfo | null {
  const filePath = existingFiles()[0]
  if (!filePath) return null
  const type = TYPES.find(t => filePath.endsWith(`.${t.ext}`))!
  return { filePath, contentType: type.contentType, version: Math.floor(fs.statSync(filePath).mtimeMs) }
}

/** Replace the background with `data` (already validated). Returns the new version. */
export function saveBackground(data: Buffer, ext: string): number {
  fs.mkdirSync(DIR, { recursive: true })
  const target = path.join(DIR, `${BASENAME}.${ext}`)
  const tmp = `${target}.tmp`
  fs.writeFileSync(tmp, data)
  for (const old of existingFiles()) if (old !== target) fs.unlinkSync(old)
  fs.renameSync(tmp, target)
  return Math.floor(fs.statSync(target).mtimeMs)
}

export function deleteBackground(): boolean {
  const files = existingFiles()
  for (const f of files) fs.unlinkSync(f)
  return files.length > 0
}
