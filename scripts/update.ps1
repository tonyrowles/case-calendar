# scripts/update.ps1
#
# Pull the latest Case Calendar from git and rebuild, rolling back on failure.
# Normally run by the tray app (scripts/tray.ps1 -> "Install update"), which stops
# the server first and restarts it afterwards. The server MUST NOT be running
# while this script rebuilds dist/ (a running server keeps serving the old
# index.html, whose asset files the build deletes -> blank pages).
#
# Manual use (server stopped):
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\update.ps1
#
# Exit codes:
#   0  updated successfully
#   3  already up to date (nothing changed)
#   5  refused: local changes to tracked files (commit/stash them first)
#   1  update failed; rolled back to the previous version and rebuilt it
#   4  update failed AND rollback failed -- run setup.ps1 or rebuild manually
#
# Output of every step is appended to logs\update.log.
# ASCII only: Windows PowerShell 5.1 misreads non-ASCII in BOM-less scripts.

[CmdletBinding()]
param(
  [string]$ProjectRoot = ''
)

# Windows PowerShell 5.1 leaves $PSScriptRoot empty in param() defaults; resolve here.
if (-not $ProjectRoot) { $ProjectRoot = Split-Path -Parent $PSScriptRoot }

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Set-Location $ProjectRoot
$logsDir = Join-Path $ProjectRoot 'logs'
New-Item -ItemType Directory -Force -Path $logsDir | Out-Null
$log = Join-Path $logsDir 'update.log'

function Write-Log([string]$msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  Add-Content -Path $log -Value $line -Encoding UTF8
  Write-Host $line
}

# Run a command line through cmd.exe, appending stdout+stderr to the log.
# (Avoids PS 5.1 wrapping native stderr in ErrorRecords under ErrorActionPreference=Stop.)
function Invoke-Step([string]$label, [string]$commandLine) {
  Write-Log "STEP $label :: $commandLine"
  cmd.exe /d /c "$commandLine >> `"$log`" 2>&1 < NUL"
  $code = $LASTEXITCODE
  if ($code -ne 0) { Write-Log "STEP $label failed with exit code $code" }
  return $code
}

function Get-GitOutput([string]$gitArgs) {
  $out = cmd.exe /d /c "git $gitArgs 2>NUL"
  if ($LASTEXITCODE -ne 0) { throw "git $gitArgs failed ($LASTEXITCODE)" }
  return (($out | Out-String).Trim())
}

Write-Log "==== update started in $ProjectRoot ===="

# 1. Refuse to touch a working tree with local edits to tracked files.
#    Exception: package-lock.json alone. It is generated, and a different npm version
#    rewrites it on any 'npm install' (e.g. setup.ps1) -- the committed copy is authoritative.
$dirty = Get-GitOutput 'status --porcelain --untracked-files=no'
if ($dirty -and (Get-GitOutput 'diff --name-only HEAD') -eq 'package-lock.json') {
  Write-Log 'Restoring package-lock.json (local npm rewrite; the committed lockfile wins)'
  [void](Get-GitOutput 'checkout HEAD -- package-lock.json')
  $dirty = Get-GitOutput 'status --porcelain --untracked-files=no'
}
if ($dirty) {
  Write-Log "Refusing to update: local changes to tracked files:`r`n$dirty"
  exit 5
}

$oldHead = Get-GitOutput 'rev-parse HEAD'

# 2. Pull (fast-forward only: never create merge commits in the install copy).
if ((Invoke-Step 'git pull' 'git pull --ff-only') -ne 0) {
  Write-Log 'git pull failed (offline, or history diverged). Nothing changed.'
  exit 1
}
$newHead = Get-GitOutput 'rev-parse HEAD'
if ($newHead -eq $oldHead) {
  Write-Log 'Already up to date.'
  exit 3
}
Write-Log "Updating $($oldHead.Substring(0,7)) -> $($newHead.Substring(0,7))"
$changed = (Get-GitOutput "diff --name-only $oldHead $newHead") -split "`r?`n"
$depsChanged = [bool]($changed | Where-Object { $_ -in @('package.json', 'package-lock.json') })
$schemaChanged = [bool]($changed | Where-Object { $_ -like 'drizzle/*' })

function Invoke-Build([bool]$installDeps) {
  if ($installDeps) {
    # npm ci installs exactly the lockfile and never rewrites it (npm install would,
    # leaving the tree dirty so the next update refuses to run).
    if ((Invoke-Step 'npm ci' 'npm ci --no-audit --no-fund') -ne 0) { return $false }
  }
  if ((Invoke-Step 'npm run build' 'npm run build') -ne 0) { return $false }
  return $true
}

# 3. Back up the database before any schema change (server is stopped, so a file copy is consistent).
$dbPath = Join-Path $ProjectRoot 'data\deadlines.db'
if ($schemaChanged -and (Test-Path $dbPath)) {
  $backupDir = Join-Path $ProjectRoot 'data\backups'
  New-Item -ItemType Directory -Force -Path $backupDir | Out-Null
  $backup = Join-Path $backupDir ("pre-update-{0}.db" -f (Get-Date -Format 'yyyyMMdd-HHmmss'))
  Copy-Item $dbPath $backup
  Write-Log "Database backed up to $backup"
}

# 4. Install / migrate / build.
$ok = Invoke-Build $depsChanged
if ($ok -and $schemaChanged) {
  # stdin is NUL: if drizzle-kit wants to ask about a destructive change, it fails
  # instead of silently dropping data, and we roll back.
  $ok = (Invoke-Step 'db push' 'npm run db:push') -eq 0
}

if ($ok) {
  Write-Log "==== update succeeded: now at $($newHead.Substring(0,7)) ===="
  exit 0
}

# 5. Roll back to the previous version and rebuild it.
Write-Log "Update failed; rolling back to $($oldHead.Substring(0,7))"
if ((Invoke-Step 'git reset' "git reset --hard $oldHead") -ne 0) {
  Write-Log '==== ROLLBACK FAILED at git reset ===='
  exit 4
}
if (Invoke-Build $depsChanged) {
  Write-Log "==== rolled back to $($oldHead.Substring(0,7)) ===="
  exit 1
}
Write-Log '==== ROLLBACK FAILED at rebuild ===='
exit 4
