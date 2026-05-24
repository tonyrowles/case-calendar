import { describe, it, expect, afterEach, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { Readable } from 'node:stream'
import {
  buildPowerShellArgs,
  spawnPowerShellApply,
  __setSpawnForTests,
  __resetSpawnForTests,
} from './spawn-apply.js'

// Minimal fake ChildProcess that EventEmits 'close' with a configurable exit code
function makeFakeChild(opts: { code: number; stderr?: string; stdout?: string }): EventEmitter & { stdout: Readable; stderr: Readable } {
  const ee = new EventEmitter() as EventEmitter & { stdout: Readable; stderr: Readable }
  ee.stdout = Readable.from([Buffer.from(opts.stdout ?? '')])
  ee.stderr = Readable.from([Buffer.from(opts.stderr ?? '')])
  // Emit close on next tick so listeners attach first
  setImmediate(() => ee.emit('close', opts.code, null))
  return ee
}

afterEach(() => {
  __resetSpawnForTests()
  vi.restoreAllMocks()
})

describe('buildPowerShellArgs', () => {
  it('returns argv in the locked order: -NoProfile -NonInteractive -ExecutionPolicy Bypass -File <ps1> -Path <png>', () => {
    const argv = buildPowerShellArgs('C:/data/wallpaper-2026-05-24T14-30-00Z.png')
    expect(argv[0]).toBe('-NoProfile')
    expect(argv[1]).toBe('-NonInteractive')
    expect(argv[2]).toBe('-ExecutionPolicy')
    expect(argv[3]).toBe('Bypass')
    expect(argv[4]).toBe('-File')
    expect(argv[5]).toMatch(/scripts[\/\\]wallpaper-set\.ps1$/)
    expect(argv[6]).toBe('-Path')
    expect(argv[7]).toBe('C:/data/wallpaper-2026-05-24T14-30-00Z.png')
  })

  it('passes the PNG path verbatim (no escaping or quoting)', () => {
    const argv = buildPowerShellArgs('/tmp/with spaces/wallpaper.png')
    expect(argv[7]).toBe('/tmp/with spaces/wallpaper.png')
  })
})

describe('spawnPowerShellApply', () => {
  it('resolves on exit code 0', async () => {
    const fakeSpawn = vi.fn().mockImplementation(() => makeFakeChild({ code: 0, stdout: 'Wallpaper set: ok' }))
    __setSpawnForTests(fakeSpawn as never)
    await expect(spawnPowerShellApply('/tmp/x.png')).resolves.toBeUndefined()
    expect(fakeSpawn).toHaveBeenCalledOnce()
    const [cmd, args] = fakeSpawn.mock.calls[0]
    expect(cmd).toBe('powershell.exe')
    expect(args).toContain('-Path')
  })

  it('rejects on non-zero exit with stderr and code attached to the Error', async () => {
    __setSpawnForTests(((..._args: unknown[]) => makeFakeChild({ code: 1, stderr: 'Wallpaper file not found: /tmp/missing.png' })) as never)
    await expect(spawnPowerShellApply('/tmp/missing.png')).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining('Wallpaper file not found'),
    })
  })

  it('rejects when spawn emits an error event (e.g., ENOENT — powershell.exe not on PATH)', async () => {
    __setSpawnForTests((() => {
      const ee = new EventEmitter() as EventEmitter & { stdout: Readable; stderr: Readable }
      ee.stdout = Readable.from([])
      ee.stderr = Readable.from([])
      setImmediate(() => ee.emit('error', new Error('ENOENT')))
      return ee
    }) as never)
    await expect(spawnPowerShellApply('/tmp/x.png')).rejects.toThrow('ENOENT')
  })

  // env-override test uses vi.resetModules() — keep last in describe block
  it('uses WALLPAPER_POWERSHELL_BIN env override when set', async () => {
    const original = process.env.WALLPAPER_POWERSHELL_BIN
    process.env.WALLPAPER_POWERSHELL_BIN = 'pwsh'
    vi.resetModules()
    const { spawnPowerShellApply: spOverride, __setSpawnForTests: setSpawn } = await import('./spawn-apply.js')
    const fake = vi.fn().mockImplementation(() => makeFakeChild({ code: 0 }))
    setSpawn(fake as never)
    await spOverride('/tmp/y.png')
    expect(fake.mock.calls[0][0]).toBe('pwsh')
    // restore
    if (original === undefined) delete process.env.WALLPAPER_POWERSHELL_BIN
    else process.env.WALLPAPER_POWERSHELL_BIN = original
    vi.resetModules()
  })
})
