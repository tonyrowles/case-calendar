# scripts/nssm-install.ps1
#
# Requirements covered: OPS-03 (documented NSSM install), OPS-04 (auto-start on boot).
#
# Canonical invocation (run as Administrator):
#   pwsh -ExecutionPolicy Bypass -File .\scripts\nssm-install.ps1
#
# Re-running is safe — idempotent: stops and removes the prior service before
# installing fresh. All NSSM settings are re-applied from this script on each run.
#
# Parameters:
#   -ServiceName  (default: CaseCalendar)
#   -InstallDir   (default: parent directory of this script, i.e. the project root)

param(
  [string]$ServiceName = "CaseCalendar",
  [string]$InstallDir = (Resolve-Path "$PSScriptRoot\..").Path,
  [string]$LogonUser = "",          # e.g. ".\yourusername" — required for wallpaper apply (Phase 9 Session 0 fix)
  [string]$LogonPassword = ""       # stored encrypted by NSSM via Windows DPAPI; omit to be prompted at install
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ---------------------------------------------------------------------------
# Pre-flight check 1: Windows system timezone must be Pacific Standard Time
# ---------------------------------------------------------------------------
$tz = [System.TimeZoneInfo]::Local.Id
if ($tz -ne "Pacific Standard Time") {
  Write-Warning "Windows TZ is '$tz'; expected 'Pacific Standard Time'. Date calculations and backups will use the wrong 'today'."
  $confirmation = Read-Host "Continue anyway? (y/N)"
  if ($confirmation -ne "y") {
    Write-Host "Aborted. Set the system timezone to 'Pacific Standard Time' or re-run with y to override."
    exit 1
  }
}

# ---------------------------------------------------------------------------
# Pre-flight check 2: NSSM must be on PATH
# ---------------------------------------------------------------------------
if (-not (Get-Command nssm -ErrorAction SilentlyContinue)) {
  Write-Error "NSSM not found in PATH. Install NSSM 2.24+ from nssm.cc/download and ensure it is on your PATH."
  exit 1
}

# ---------------------------------------------------------------------------
# Pre-flight check 3: build artifacts must exist (prevents NSSM restart loop)
# ---------------------------------------------------------------------------
$serverJs = Join-Path $InstallDir "dist\server\src\server\index.js"
if (-not (Test-Path $serverJs)) {
  Write-Error "dist\server\src\server\index.js missing in '$InstallDir'. Run 'npm run build' first, then re-run this script."
  exit 1
}

# ---------------------------------------------------------------------------
# Idempotent remove: stop + remove the existing service if present
# ---------------------------------------------------------------------------
nssm status $ServiceName 2>$null | Out-Null
if ($LASTEXITCODE -eq 0) {
  Write-Host "Stopping existing $ServiceName service..."
  nssm stop $ServiceName confirm 2>$null | Out-Null
  # Poll until fully stopped (max 30 seconds) to avoid the SCM async-stop race
  # where nssm remove is called while the service is still in SERVICE_STOP_PENDING,
  # causing a silent failure that leaves the old service registered.
  $waited = 0
  while ($waited -lt 30) {
    $status = (nssm status $ServiceName 2>$null)
    if ($status -match 'SERVICE_STOPPED') { break }
    Start-Sleep -Seconds 1
    $waited++
  }
  nssm remove $ServiceName confirm | Out-Null
}

# ---------------------------------------------------------------------------
# Install
# ---------------------------------------------------------------------------
$nodeExe = (Get-Command node -ErrorAction Stop).Source
$logsDir = Join-Path $InstallDir "logs"
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null

nssm install $ServiceName $nodeExe $serverJs
nssm set $ServiceName AppDirectory $InstallDir
nssm set $ServiceName AppEnvironmentExtra "TZ=America/Los_Angeles" "NODE_ENV=production"
nssm set $ServiceName AppStdout (Join-Path $logsDir "case-calendar.log")
nssm set $ServiceName AppStderr (Join-Path $logsDir "case-calendar.err")
nssm set $ServiceName AppRotateFiles 1
nssm set $ServiceName AppRotateOnline 1
nssm set $ServiceName AppRotateBytes 10485760
nssm set $ServiceName AppExit Default Restart
nssm set $ServiceName Start SERVICE_AUTO_START

# ---------------------------------------------------------------------------
# Phase 9 Session 0 fix: optionally run the service as a specific user account.
# When ObjectName is set to a real user, the service runs in that user's
# interactive session (Session 1+), where IDesktopWallpaper::SetWallpaper
# can reach the visible desktop. LocalSystem (default) runs in Session 0
# and silently no-ops wallpaper apply. See docs/DEPLOYMENT.md#nssm-session-0-fix
# ---------------------------------------------------------------------------
if ($LogonUser -ne "") {
  if ($LogonPassword -eq "") {
    $secure = Read-Host "Enter password for $LogonUser (stored encrypted via Windows DPAPI)" -AsSecureString
    $BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $LogonPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
    [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($BSTR) | Out-Null
  }
  nssm set $ServiceName ObjectName $LogonUser $LogonPassword
  Write-Host "Service account set to: $LogonUser (Session 1+ — wallpaper apply enabled)"
} else {
  Write-Warning "No -LogonUser provided. Service will run as LocalSystem (Session 0)."
  Write-Warning "Phase 9 wallpaper apply will silently fail until you re-run with -LogonUser '.\<username>'."
  Write-Warning "See docs/DEPLOYMENT.md#nssm-session-0-fix for the fix or the Task Scheduler alternative."
}

# ---------------------------------------------------------------------------
# Instructions — do NOT auto-start; let the operator verify first
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "$ServiceName installed but NOT started."
Write-Host "Start with:   nssm start $ServiceName"
Write-Host "Verify with:  nssm status $ServiceName ; netstat -ano | findstr 3747"
Write-Host "Tail logs:    Get-Content -Wait $logsDir\case-calendar.log"
Write-Host ""
Write-Host "After verification, the service will auto-start on every Windows boot (Start=SERVICE_AUTO_START)."
Write-Host ""
Write-Host "WALLPAPER (Phase 9): For desktop wallpaper apply to work, re-run with:"
Write-Host "  pwsh -ExecutionPolicy Bypass -File .\scripts\nssm-install.ps1 -LogonUser '.\<username>'"
Write-Host "(You will be prompted for the password.) See docs/DEPLOYMENT.md#desktop-wallpaper-phase-9"
