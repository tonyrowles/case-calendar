import { spawn } from 'node:child_process'
import path from 'node:path'
import { logger } from '../logger.js'

/** A connected monitor (from scripts/monitors.ps1). width/height are physical pixels. */
export interface Monitor {
  id: string
  left: number
  top: number
  width: number
  height: number
  /** Windows display scaling: 1.5 = 150% */
  scale: number
  primary: boolean
}

/** What the wallpaper worker renders for: logical size, pixel ratio, and where to apply. */
export interface WallpaperTarget {
  /** null = apply to every monitor (no monitor info available) */
  monitorId: string | null
  logicalWidth: number
  logicalHeight: number
  deviceScaleFactor: number
}

/** Used when monitors can't be detected (non-Windows, script failure): the most common screen size. */
export const FALLBACK_TARGET: WallpaperTarget = { monitorId: null, logicalWidth: 1920, logicalHeight: 1080, deviceScaleFactor: 1 }

const PS1 = path.resolve('scripts/monitors.ps1')
const CACHE_MS = 10 * 60_000

export type DetectFn = () => Promise<Monitor[]>

const runScript: DetectFn = () => new Promise((resolve, reject) => {
  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', PS1], {
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  })
  let out = ''
  let err = ''
  child.stdout.on('data', (c: Buffer) => { out += c.toString('utf8') })
  child.stderr.on('data', (c: Buffer) => { err += c.toString('utf8') })
  child.on('error', reject)
  child.on('close', code => {
    if (code !== 0) return reject(new Error(`monitors.ps1 exited ${code}: ${err.trim()}`))
    try {
      const parsed = JSON.parse(out.trim() || '[]') as Monitor[]
      resolve(parsed.filter(m => m.width > 0 && m.height > 0))
    } catch (e) {
      reject(e)
    }
  })
})

let detectImpl: DetectFn = runScript
export function __setDetectMonitors(fn: DetectFn): void { detectImpl = fn; cache = null }
export function __resetDetectMonitors(): void { detectImpl = runScript; cache = null }

let cache: { at: number; monitors: Monitor[] } | null = null

/** Connected monitors (cached 10 minutes; [] when unavailable). */
export async function listMonitors(force = false): Promise<Monitor[]> {
  // No real detection off Windows or inside tests (tests inject a list via __setDetectMonitors)
  if ((process.platform !== 'win32' || process.env.VITEST === 'true') && detectImpl === runScript) return []
  if (!force && cache && Date.now() - cache.at < CACHE_MS) return cache.monitors
  try {
    const monitors = await detectImpl()
    cache = { at: Date.now(), monitors }
    return monitors
  } catch (err) {
    logger.warn({ err }, 'monitors: detection failed; using the last known list or the fallback size')
    return cache?.monitors ?? []
  }
}

/**
 * The monitor to render for: the chosen id when it is connected, else the primary, else
 * the first. Logical size = physical / display scaling (rounded), rendered at that scale
 * so the PNG is the monitor's exact physical resolution.
 */
export function pickTarget(monitors: Monitor[], chosen: string): WallpaperTarget {
  const m =
    (chosen !== 'primary' ? monitors.find(x => x.id === chosen) : undefined) ??
    monitors.find(x => x.primary) ??
    monitors[0]
  if (!m) return FALLBACK_TARGET
  const scale = m.scale > 0 ? m.scale : 1
  return {
    monitorId: m.id,
    logicalWidth: Math.round(m.width / scale),
    logicalHeight: Math.round(m.height / scale),
    deviceScaleFactor: scale,
  }
}
