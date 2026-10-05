import { describe, it, expect, afterEach } from 'vitest'
import { FALLBACK_TARGET, __resetDetectMonitors, __setDetectMonitors, listMonitors, pickTarget, type Monitor } from './monitors.js'
import { buildPowerShellArgs } from './spawn-apply.js'

const G9: Monitor = { id: 'mon-g9', left: 0, top: 0, width: 7680, height: 2160, scale: 1.5, primary: true }
const SIDE: Monitor = { id: 'mon-side', left: 7680, top: 0, width: 2560, height: 1440, scale: 1, primary: false }

describe('pickTarget', () => {
  it('renders the primary monitor by default at its logical size and display scaling', () => {
    expect(pickTarget([SIDE, G9], 'primary')).toEqual({ monitorId: 'mon-g9', logicalWidth: 5120, logicalHeight: 1440, deviceScaleFactor: 1.5 })
  })

  it('uses the chosen monitor when it is connected, else falls back to the primary', () => {
    expect(pickTarget([G9, SIDE], 'mon-side')).toMatchObject({ monitorId: 'mon-side', logicalWidth: 2560, logicalHeight: 1440, deviceScaleFactor: 1 })
    expect(pickTarget([G9, SIDE], 'unplugged-monitor')).toMatchObject({ monitorId: 'mon-g9' })
  })

  it('falls back to the original size (all monitors) when nothing is detected', () => {
    expect(pickTarget([], 'primary')).toEqual(FALLBACK_TARGET)
  })
})

describe('listMonitors', () => {
  afterEach(() => __resetDetectMonitors())

  it('caches detection, and keeps the last known list if detection fails', async () => {
    let calls = 0
    __setDetectMonitors(async () => { calls++; return [G9] })
    expect(await listMonitors()).toEqual([G9])
    expect(await listMonitors()).toEqual([G9])
    expect(calls).toBe(1)
  })

  it('returns [] when detection fails and nothing is cached', async () => {
    __setDetectMonitors(async () => { throw new Error('powershell failed') })
    expect(await listMonitors(true)).toEqual([])
  })
})

describe('buildPowerShellArgs', () => {
  it('passes -MonitorId only when a monitor is chosen', () => {
    expect(buildPowerShellArgs('C:/x.png', 'mon-g9').slice(-2)).toEqual(['-MonitorId', 'mon-g9'])
    expect(buildPowerShellArgs('C:/x.png', null)).not.toContain('-MonitorId')
  })
})
