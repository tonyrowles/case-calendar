# scripts/wallpaper-set.ps1
#
# Phase 9 - WALL-03: Apply a PNG as the Windows desktop wallpaper via the
# IDesktopWallpaper COM interface (CLSID {C2CF3110-460E-4fc1-B9D0-8A1C0C9CC4BD}),
# declared in wallpaper-com.ps1 (SetWallpaper via C# COM interop).
#
# -MonitorId: only that monitor's wallpaper changes (ids from monitors.ps1); omitted =
# every monitor.
#
# Invoked by the Node wallpaper worker (src/server/workers/spawn-apply.ts).
# Manual debug:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\wallpaper-set.ps1 -Path "C:\path\to\wallpaper.png" [-MonitorId "<id>"]
# ASCII only: Windows PowerShell 5.1 misreads non-ASCII in BOM-less scripts.

[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)]
  [string]$Path,
  [string]$MonitorId = ''
)

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

if (-not (Test-Path $Path)) {
  Write-Error "Wallpaper file not found: $Path"
  exit 1
}

# IDesktopWallpaper requires an absolute path.
$resolved = (Resolve-Path $Path).ProviderPath

. "$PSScriptRoot\wallpaper-com.ps1"

if ($MonitorId) {
  [CaseCalendar.DesktopWallpaper]::SetOn($MonitorId, $resolved)
  Write-Host "Wallpaper set on monitor ${MonitorId}: $resolved"
} else {
  [CaseCalendar.DesktopWallpaper]::Set($resolved)
  Write-Host "Wallpaper set: $resolved"
}
