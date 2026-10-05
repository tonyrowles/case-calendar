# scripts/install-update.ps1
#
# Installed copy only: run a downloaded CaseCalendarSetup-<version>.exe silently.
# Started by tray.ps1 ("Install update") after the server downloaded the installer
# (POST /api/updates/download, which can use the GitHub token from Settings > Setup).
# The tray copies this file to %TEMP% first (the installer replaces the program folder)
# and then exits. Steps:
#   1. wait for the tray process (-WaitPid) and its server to exit
#   2. run the installer with /VERYSILENT; it starts the tray again when it finishes
# If the installer fails, the current version's tray is restarted.
#
# ASCII only: Windows PowerShell 5.1 misreads non-ASCII in BOM-less scripts.

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Installer,
  [Parameter(Mandatory = $true)][string]$Version,
  [int]$WaitPid = 0,
  [Parameter(Mandatory = $true)][string]$LogsDir,
  [Parameter(Mandatory = $true)][string]$TrayScript
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null
$log = Join-Path $LogsDir 'update.log'
function Write-Log([string]$msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  try { Add-Content -Path $log -Value $line -Encoding UTF8 } catch { }
}

function Start-Tray {
  Start-Process -FilePath "$env:WINDIR\System32\conhost.exe" -ArgumentList "--headless powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File `"$TrayScript`"" -WorkingDirectory $env:TEMP
}

Write-Log "==== update to $Version started ===="
try {
  if ($WaitPid -gt 0) {
    $p = Get-Process -Id $WaitPid -ErrorAction SilentlyContinue
    if ($p) { [void]$p.WaitForExit(60000) }
  }
  if (-not (Test-Path $Installer) -or [System.IO.Path]::GetFileName($Installer) -notlike 'CaseCalendarSetup-*.exe') {
    throw "Installer not found or unexpected: $Installer"
  }

  Write-Log "Running $Installer"
  # Not Start-Process -Wait: that waits for the whole process tree, including the tray the
  # installer starts at the end, so it would never return
  $proc = Start-Process -FilePath $Installer -ArgumentList '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', "/LOG=`"$(Join-Path $LogsDir 'install.log')`"" -PassThru
  $null = $proc.Handle   # keep a handle so ExitCode is available after exit
  $proc.WaitForExit()
  Write-Log "Installer exited with $($proc.ExitCode)"
  if ($proc.ExitCode -ne 0) { throw "Installer failed (exit code $($proc.ExitCode)); see install.log" }
  Remove-Item -Force $Installer -ErrorAction SilentlyContinue
  Write-Log "==== update to $Version finished ===="
} catch {
  Write-Log "Update failed: $($_.Exception.Message)"
  # The installer did not finish: bring the current version back up (the tray's
  # single-instance mutex makes this a no-op if it is already running)
  Start-Tray
  exit 1
}
