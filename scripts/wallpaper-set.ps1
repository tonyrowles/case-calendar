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

# IDesktopWallpaper is IUnknown-only (no IDispatch), so PowerShell late binding
# ($obj.SetWallpaper(...)) fails with "does not contain a method named
# 'SetWallpaper'". Declare the interface via C# COM interop instead. Methods must
# be declared in vtable order; only the first two slots are needed here.
# CLSID DesktopWallpaper: C2CF3110-460E-4fc1-B9D0-8A1C0C9CC4BD
# IID IDesktopWallpaper:  B92B56A9-8B55-4E14-9A89-0199BBB6F93B
if (-not ('CaseCalendar.DesktopWallpaper' -as [Type])) {
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

namespace CaseCalendar {
  [ComImport, Guid("B92B56A9-8B55-4E14-9A89-0199BBB6F93B"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  internal interface IDesktopWallpaper {
    void SetWallpaper([MarshalAs(UnmanagedType.LPWStr)] string monitorID, [MarshalAs(UnmanagedType.LPWStr)] string wallpaper);
    [return: MarshalAs(UnmanagedType.LPWStr)]
    string GetWallpaper([MarshalAs(UnmanagedType.LPWStr)] string monitorID);
  }

  [ComImport, Guid("C2CF3110-460E-4fc1-B9D0-8A1C0C9CC4BD")]
  internal class DesktopWallpaperClass { }

  public static class DesktopWallpaper {
    // null monitorID applies to all monitors (per Microsoft docs and CONTEXT.md decision)
    public static void Set(string path) {
      ((IDesktopWallpaper)new DesktopWallpaperClass()).SetWallpaper(null, path);
    }
    public static string Get() {
      return ((IDesktopWallpaper)new DesktopWallpaperClass()).GetWallpaper(null);
    }
  }
}
'@
}

[CaseCalendar.DesktopWallpaper]::Set($resolved)

Write-Host "Wallpaper set: $resolved"
