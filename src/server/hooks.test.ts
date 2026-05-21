/**
 * Tests for HOOK-02/03: Worker stubs and PowerShell placeholder exist
 *
 * These are static existence checks — the files should exist with the
 * correct named exports and TODO comments.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// Project root is process.cwd() when running vitest from the project root
const PROJECT_ROOT = process.cwd()

describe('HOOK-02: Worker stub files exist with correct exports', () => {
  it('src/server/workers/wallpaper.ts exists', () => {
    const filePath = path.join(PROJECT_ROOT, 'src/server/workers/wallpaper.ts')
    expect(fs.existsSync(filePath)).toBe(true)
  })

  it('src/server/workers/email.ts exists', () => {
    const filePath = path.join(PROJECT_ROOT, 'src/server/workers/email.ts')
    expect(fs.existsSync(filePath)).toBe(true)
  })

  it('wallpaper.ts exports startWallpaperWorker as a function', async () => {
    const mod = await import('./workers/wallpaper.js')
    expect(typeof mod.startWallpaperWorker).toBe('function')
  })

  it('email.ts exports startEmailWorker as a function', async () => {
    const mod = await import('./workers/email.js')
    expect(typeof mod.startEmailWorker).toBe('function')
  })

  it('startWallpaperWorker is a no-op (returns undefined, does not throw)', async () => {
    const { startWallpaperWorker } = await import('./workers/wallpaper.js')
    expect(() => startWallpaperWorker()).not.toThrow()
    expect(startWallpaperWorker()).toBeUndefined()
  })

  it('startEmailWorker is a no-op (returns undefined, does not throw)', async () => {
    const { startEmailWorker } = await import('./workers/email.js')
    expect(() => startEmailWorker()).not.toThrow()
    expect(startEmailWorker()).toBeUndefined()
  })
})

describe('HOOK-03: scripts/wallpaper-set.ps1 placeholder exists', () => {
  it('scripts/wallpaper-set.ps1 exists at project root', () => {
    const filePath = path.join(PROJECT_ROOT, 'scripts/wallpaper-set.ps1')
    expect(fs.existsSync(filePath)).toBe(true)
  })

  it('scripts/wallpaper-set.ps1 contains # TODO placeholder comment', () => {
    const filePath = path.join(PROJECT_ROOT, 'scripts/wallpaper-set.ps1')
    const contents = fs.readFileSync(filePath, 'utf-8')
    expect(contents).toContain('# TODO')
  })
})
