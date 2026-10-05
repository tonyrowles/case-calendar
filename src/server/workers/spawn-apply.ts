import { spawn, type SpawnOptions, type ChildProcess } from 'node:child_process'
import path from 'node:path'
import { logger } from '../logger.js'

const PS1_PATH = path.resolve('scripts/wallpaper-set.ps1')
const POWERSHELL_BIN = process.env.WALLPAPER_POWERSHELL_BIN ?? 'powershell.exe'

/**
 * Build the argv passed to powershell.exe. Exported as a pure function so tests
 * can assert the shape without spawning a process.
 *
 * The result of joining [POWERSHELL_BIN, ...buildPowerShellArgs(absolutePath)]
 * matches CONTEXT.md decision:
 *   powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File <ps1> -Path <png>
 */
export function buildPowerShellArgs(absolutePngPath: string, monitorId: string | null = null): string[] {
  return [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy', 'Bypass',
    '-File', PS1_PATH,
    '-Path', absolutePngPath,
    // Only the chosen monitor's wallpaper changes; others keep theirs
    ...(monitorId ? ['-MonitorId', monitorId] : []),
  ]
}

/**
 * Dependency-injection seam: tests substitute a fake spawn that records calls.
 * In production, this is the built-in child_process.spawn.
 */
export type SpawnFn = (cmd: string, args: string[], opts?: SpawnOptions) => ChildProcess
// Node's spawn() is overloaded; cast to the narrow 3-arg form we actually use here.
// All real invocations go through buildPowerShellArgs() + the spawnImpl(cmd, args, opts)
// call at line ~46, so this cast is safe — the overload we use is satisfied.
const realSpawn = spawn as unknown as SpawnFn
let spawnImpl: SpawnFn = realSpawn

export function __setSpawnForTests(fn: SpawnFn): void { spawnImpl = fn }
export function __resetSpawnForTests(): void { spawnImpl = realSpawn }

/**
 * Spawn powershell.exe to apply the wallpaper. Resolves on exit code 0;
 * rejects on non-zero exit with stderr contents + exit code attached.
 * Plan 01's wallpaper.ts catches the rejection at warn level (worker does not crash).
 */
export async function spawnPowerShellApply(absolutePngPath: string, monitorId: string | null = null): Promise<void> {
  const args = buildPowerShellArgs(absolutePngPath, monitorId)
  logger.info({ ps1: PS1_PATH, png: absolutePngPath }, 'wallpaper: spawning powershell apply')

  return new Promise<void>((resolve, reject) => {
    // windowsHide: the server may run without a console (tray launcher); never flash a window
    const child = spawnImpl(POWERSHELL_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
    let stderr = ''
    let stdout = ''
    child.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString('utf8') })
    child.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString('utf8') })
    child.on('error', (err) => reject(err))
    child.on('close', (code) => {
      if (code === 0) {
        if (stdout) logger.info({ stdout: stdout.trim() }, 'wallpaper: powershell apply succeeded')
        resolve()
      } else {
        const err: Error & { code?: number; stderr?: string; stdout?: string } = new Error(
          `wallpaper-set.ps1 exited with code ${code}: ${stderr.trim() || '(no stderr)'}`
        )
        err.code = code ?? -1
        err.stderr = stderr
        err.stdout = stdout
        reject(err)
      }
    })
  })
}
