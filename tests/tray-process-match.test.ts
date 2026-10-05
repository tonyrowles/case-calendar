// stop.ps1 (run by the installer before an upgrade) and install-tray.ps1 stop the running
// tray by command line. They must match only processes RUNNING tray.ps1, never the update
// helper, which receives the tray's path as -TrayScript and must survive the upgrade.
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

function trayPattern(script: string): RegExp {
  const src = fs.readFileSync(path.join('scripts', script), 'utf8')
  const m = /'(-File\\s\+[^']*tray\\\.ps1[^']*)'/.exec(src)
  if (!m) throw new Error(`no tray match pattern in ${script}`)
  return new RegExp(m[1], 'i')   // PowerShell -match is case-insensitive
}

const RUNS_TRAY = [
  'powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File "C:\\Users\\x\\AppData\\Local\\Programs\\Case Calendar\\app\\scripts\\tray.ps1"',
  'powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File "C:\\Users\\x\\AppData\\Local\\Programs\\Case Calendar\\app\\scripts\\tray.ps1" -Open -OpenPath /settings',
  'powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File "C:\\apps\\case-calendar\\scripts\\tray.ps1"',
  'powershell.exe -STA -File C:\\apps\\case-calendar\\scripts\\tray.ps1',
]
const DOES_NOT = [
  'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\\Users\\x\\AppData\\Local\\Temp\\CaseCalendar-install-update.ps1" -Installer "C:\\Temp\\CaseCalendarSetup-0.2.2.exe" -Version "0.2.2" -WaitPid 123 -LogsDir "C:\\logs" -TrayScript "C:\\Users\\x\\AppData\\Local\\Programs\\Case Calendar\\app\\scripts\\tray.ps1"',
  'powershell.exe -File "C:\\other\\nottray.ps1"',
]

describe.each(['stop.ps1', 'install-tray.ps1'])('%s tray process match', (script) => {
  const rx = trayPattern(script)
  it.each(RUNS_TRAY)('stops a running tray: %s', (cmd) => expect(rx.test(cmd)).toBe(true))
  it.each(DOES_NOT)('leaves alone: %s', (cmd) => expect(rx.test(cmd)).toBe(false))
})
