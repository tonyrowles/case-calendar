# scripts/wallpaper-set.ps1
#
# Phase 9 — WALL-03: Apply a PNG as the Windows desktop wallpaper via the
# IDesktopWallpaper COM interface (CLSID {C2CF3110-460E-4fc1-B9D0-8A1C0C9CC4BD}).
# Replaces the Phase 1 # placeholder.
#
# Invoked by the Node wallpaper worker (src/server/workers/spawn-apply.ts).
# Manual debug: pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\wallpaper-set.ps1 -Path "C:\path\to\wallpaper.png"

[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)]
  [string]$Path
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

$type = [Type]::GetTypeFromCLSID([Guid]'{C2CF3110-460E-4fc1-B9D0-8A1C0C9CC4BD}')
if (-not $type) {
  Write-Error "IDesktopWallpaper COM not available on this system (requires Windows 8+)"
  exit 1
}

$wallpaper = [Activator]::CreateInstance($type)
# $null monitorID applies to all monitors (per Microsoft docs and CONTEXT.md decision)
$wallpaper.SetWallpaper($null, $resolved)

Write-Host "Wallpaper set: $resolved"
