# scripts/install-update.ps1
#
# Installed copy only: download a newer CaseCalendarSetup-<version>.exe and run it silently.
# Started by tray.ps1 ("Install update"), which copies this file to %TEMP% first (the
# installer replaces the program folder) and then exits. Steps:
#   1. wait for the tray process (-WaitPid) to exit
#   2. download the installer to %TEMP%
#   3. run it with /VERYSILENT; the installer starts the tray again when it finishes
# If anything fails before the installer runs, the current version's tray is restarted.
#
# ASCII only: Windows PowerShell 5.1 misreads non-ASCII in BOM-less scripts.

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$Url,
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

  if ($Url -notmatch '^https://github\.com/[^/]+/[^/]+/releases/download/') {
    throw "Refusing to download from an unexpected address: $Url"
  }
  $setup = Join-Path $env:TEMP ("CaseCalendarSetup-{0}.exe" -f ($Version -replace '[^0-9A-Za-z.\-]', ''))
  Write-Log "Downloading $Url"
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $ProgressPreference = 'SilentlyContinue'
  Invoke-WebRequest -Uri $Url -OutFile $setup -UseBasicParsing -TimeoutSec 600 -Headers @{ 'User-Agent' = 'CaseCalendar' }
  if ((Get-Item $setup).Length -lt 1MB) { throw 'Downloaded installer is too small; aborting.' }

  Write-Log "Running $setup"
  $proc = Start-Process -FilePath $setup -ArgumentList '/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', "/LOG=`"$(Join-Path $LogsDir 'install.log')`"" -PassThru -Wait
  Write-Log "Installer exited with $($proc.ExitCode)"
  if ($proc.ExitCode -ne 0) { throw "Installer failed (exit code $($proc.ExitCode)); see install.log" }
  Remove-Item -Force $setup -ErrorAction SilentlyContinue
  Write-Log "==== update to $Version finished ===="
} catch {
  Write-Log "Update failed: $($_.Exception.Message)"
  # The installer did not finish: bring the current version back up (the tray's
  # single-instance mutex makes this a no-op if it is already running)
  Start-Tray
  exit 1
}
