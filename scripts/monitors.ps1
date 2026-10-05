# scripts/monitors.ps1
#
# Print the connected monitors as JSON for the wallpaper worker:
#   [{"id":"\\?\DISPLAY#...","left":0,"top":0,"width":7680,"height":2160,"scale":1.0,"primary":true}, ...]
# width/height are physical pixels; scale is Windows display scaling (1.5 = 150%).
#
# Manual check:  powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\monitors.ps1
# ASCII only: Windows PowerShell 5.1 misreads non-ASCII in BOM-less scripts.

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

. "$PSScriptRoot\wallpaper-com.ps1"

$monitors = @([CaseCalendar.DesktopWallpaper]::Monitors() | ForEach-Object {
  [ordered]@{
    id      = $_.Id
    left    = $_.Left
    top     = $_.Top
    width   = $_.Width
    height  = $_.Height
    scale   = [math]::Round($_.Scale, 2)
    primary = $_.Primary
  }
})
# -InputObject keeps a single monitor as a one-element JSON array
ConvertTo-Json -InputObject $monitors -Compress -Depth 3
