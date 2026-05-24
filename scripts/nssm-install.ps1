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
  [string]$InstallDir = (Resolve-Path "$PSScriptRoot\..").Path
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
  nssm stop $ServiceName 2>$null | Out-Null
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
# Instructions — do NOT auto-start; let the operator verify first
# ---------------------------------------------------------------------------
Write-Host ""
Write-Host "$ServiceName installed but NOT started."
Write-Host "Start with:   nssm start $ServiceName"
Write-Host "Verify with:  nssm status $ServiceName ; netstat -ano | findstr 3747"
Write-Host "Tail logs:    Get-Content -Wait $logsDir\case-calendar.log"
Write-Host ""
Write-Host "After verification, the service will auto-start on every Windows boot (Start=SERVICE_AUTO_START)."
