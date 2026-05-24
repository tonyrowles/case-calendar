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
export function buildPowerShellArgs(absolutePngPath: string): string[] {
  return [
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy', 'Bypass',
    '-File', PS1_PATH,
    '-Path', absolutePngPath,
  ]
}

/**
 * Dependency-injection seam: tests substitute a fake spawn that records calls.
 * In production, this is the built-in child_process.spawn.
 */
export type SpawnFn = (cmd: string, args: string[], opts?: SpawnOptions) => ChildProcess
let spawnImpl: SpawnFn = spawn

export function __setSpawnForTests(fn: SpawnFn): void { spawnImpl = fn }
export function __resetSpawnForTests(): void { spawnImpl = spawn }

/**
 * Spawn powershell.exe to apply the wallpaper. Resolves on exit code 0;
 * rejects on non-zero exit with stderr contents + exit code attached.
 * Plan 01's wallpaper.ts catches the rejection at warn level (worker does not crash).
 */
export async function spawnPowerShellApply(absolutePngPath: string): Promise<void> {
  const args = buildPowerShellArgs(absolutePngPath)
  logger.info({ ps1: PS1_PATH, png: absolutePngPath }, 'wallpaper: spawning powershell apply')

  return new Promise<void>((resolve, reject) => {
    const child = spawnImpl(POWERSHELL_BIN, args, { stdio: ['ignore', 'pipe', 'pipe'] })
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
