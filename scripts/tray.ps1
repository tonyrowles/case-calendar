# scripts/tray.ps1
#
# Case Calendar tray app: runs the server with no console window and puts an icon
# in the notification area with Open / Refresh wallpaper / Restart / Update / Logs /
# Quit. Restarts the server if it crashes and checks git for updates.
#
# Started at logon by the "CaseCalendar" scheduled task that scripts/install-tray.ps1
# registers. Manual start (no window; install-tray.ps1 explains why conhost --headless):
#   conhost.exe --headless powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File .\scripts\tray.ps1
#
# ASCII only: Windows PowerShell 5.1 misreads non-ASCII in BOM-less scripts.

[CmdletBinding()]
param(
  [string]$ProjectRoot = ''
)

# Windows PowerShell 5.1 leaves $PSScriptRoot empty in param() defaults; resolve here.
if (-not $ProjectRoot) { $ProjectRoot = Split-Path -Parent $PSScriptRoot }

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

# --- single instance ---------------------------------------------------------
$createdNew = $false
$script:mutex = New-Object System.Threading.Mutex($true, 'Local\CaseCalendarTray', [ref]$createdNew)
if (-not $createdNew) { exit 0 }

# --- constants ---------------------------------------------------------------
$Port = 3747
$AppUrl = "http://127.0.0.1:$Port"
$ServerEntry = 'dist\server\src\server\index.js'
$LogsDir = Join-Path $ProjectRoot 'logs'
$ServerLog = Join-Path $LogsDir 'case-calendar.log'
$TrayLog = Join-Path $LogsDir 'tray.log'
$MaxLogBytes = 10MB
$UpdateCheckEvery = [TimeSpan]::FromHours(6)
$CrashWindow = [TimeSpan]::FromMinutes(10)
$MaxCrashesInWindow = 3

New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null
Set-Location $ProjectRoot

# --- state -------------------------------------------------------------------
$script:server = $null            # System.Diagnostics.Process (cmd.exe wrapping node)
$script:expectStop = $false       # true while we stop the server on purpose
$script:updating = $null          # update.ps1 process while an update runs
$script:crashTimes = New-Object System.Collections.ArrayList
$script:gaveUp = $false
$script:pendingUpdates = 0
$script:lastNotifiedUpdates = 0
$script:nextUpdateCheck = (Get-Date).AddSeconds(30)

function Write-TrayLog([string]$msg) {
  $line = "[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  try { Add-Content -Path $TrayLog -Value $line -Encoding UTF8 } catch { }
}

# Run a console program with no window; returns @{ Code; Out }. Kills it on timeout.
function Invoke-Hidden([string]$file, [string]$arguments, [int]$timeoutMs = 30000) {
  $psi = New-Object System.Diagnostics.ProcessStartInfo($file, $arguments)
  $psi.WorkingDirectory = $ProjectRoot
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.RedirectStandardOutput = $true
  $psi.RedirectStandardError = $true
  $p = [System.Diagnostics.Process]::Start($psi)
  $outTask = $p.StandardOutput.ReadToEndAsync()
  $errTask = $p.StandardError.ReadToEndAsync()
  if (-not $p.WaitForExit($timeoutMs)) {
    try { $p.Kill() } catch { }
    return @{ Code = -1; Out = 'timed out' }
  }
  return @{ Code = $p.ExitCode; Out = ($outTask.Result + $errTask.Result).Trim() }
}

# --- tray icon -----------------------------------------------------------------
function New-TrayIcon {
  $bmp = New-Object System.Drawing.Bitmap 32, 32
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::Transparent)
  $blue = [System.Drawing.Color]::FromArgb(29, 78, 216)
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), 3, 6, 26, 23)
  $g.FillRectangle((New-Object System.Drawing.SolidBrush $blue), 3, 6, 26, 7)
  $g.DrawRectangle((New-Object System.Drawing.Pen($blue, 2)), 3, 6, 26, 23)
  $g.FillRectangle((New-Object System.Drawing.SolidBrush $blue), 9, 3, 3, 6)
  $g.FillRectangle((New-Object System.Drawing.SolidBrush $blue), 20, 3, 3, 6)
  $dot = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(180, 83, 9))
  $g.FillRectangle($dot, 8, 17, 5, 4); $g.FillRectangle($dot, 16, 17, 5, 4); $g.FillRectangle($dot, 8, 23, 5, 3)
  $g.Dispose()
  return [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
}

$notify = New-Object System.Windows.Forms.NotifyIcon
$notify.Icon = New-TrayIcon
$notify.Text = 'Case Calendar - starting'
$notify.Visible = $true

function Show-Balloon([string]$title, [string]$text, [string]$kind = 'Info') {
  $notify.ShowBalloonTip(6000, $title, $text, [System.Windows.Forms.ToolTipIcon]::$kind)
}

function Set-Status([string]$status) {
  $t = "Case Calendar - $status"
  if ($t.Length -gt 63) { $t = $t.Substring(0, 63) }
  $notify.Text = $t
}

# --- server lifecycle --------------------------------------------------------
function Get-PortOwners {
  @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique)
}

function Stop-PortOwners {
  foreach ($procId in Get-PortOwners) {
    Write-TrayLog "Stopping leftover process $procId on port $Port"
    Invoke-Hidden 'taskkill.exe' "/PID $procId /T /F" 10000 | Out-Null
  }
}

function Rotate-ServerLog {
  if ((Test-Path $ServerLog) -and (Get-Item $ServerLog).Length -gt $MaxLogBytes) {
    Move-Item -Force $ServerLog "$ServerLog.1"
  }
}

function Start-Server {
  if (-not (Test-Path (Join-Path $ProjectRoot $ServerEntry))) {
    Set-Status 'not built'
    Show-Balloon 'Case Calendar' "Server not built. Run 'npm run build' in $ProjectRoot, then Restart server." 'Error'
    Write-TrayLog "Missing $ServerEntry"
    return
  }
  Stop-PortOwners
  Rotate-ServerLog
  $psi = New-Object System.Diagnostics.ProcessStartInfo('cmd.exe', "/d /c node $ServerEntry >> `"$ServerLog`" 2>&1")
  $psi.WorkingDirectory = $ProjectRoot
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $psi.EnvironmentVariables['TZ'] = 'America/Los_Angeles'
  $psi.EnvironmentVariables['NODE_ENV'] = 'production'
  $script:server = [System.Diagnostics.Process]::Start($psi)
  $script:expectStop = $false
  Set-Status 'running'
  Write-TrayLog "Server started (pid $($script:server.Id))"
}

function Stop-Server {
  $script:expectStop = $true
  if ($script:server -and -not $script:server.HasExited) {
    Invoke-Hidden 'taskkill.exe' "/PID $($script:server.Id) /T /F" 15000 | Out-Null
    $script:server.WaitForExit(10000) | Out-Null
  }
  Stop-PortOwners
  $script:server = $null
  Set-Status 'stopped'
  Write-TrayLog 'Server stopped'
}

function Restart-Server {
  $script:gaveUp = $false
  $script:crashTimes.Clear()
  Stop-Server
  Start-Server
}

# Watchdog: restart after an unexpected exit; give up after repeated crashes.
function Test-Server {
  if ($script:updating -or $script:expectStop -or $script:gaveUp) { return }
  if ($null -eq $script:server -or -not $script:server.HasExited) { return }
  $now = Get-Date
  [void]$script:crashTimes.Add($now)
  while ($script:crashTimes.Count -gt 0 -and ($now - $script:crashTimes[0]) -gt $CrashWindow) { $script:crashTimes.RemoveAt(0) }
  Write-TrayLog "Server exited unexpectedly (code $($script:server.ExitCode)); crashes in window: $($script:crashTimes.Count)"
  if ($script:crashTimes.Count -ge $MaxCrashesInWindow) {
    $script:gaveUp = $true
    $script:server = $null
    Set-Status 'STOPPED (crashing)'
    Show-Balloon 'Case Calendar stopped' 'The server keeps crashing. Check the server log, then use Restart server.' 'Error'
    return
  }
  Show-Balloon 'Case Calendar' 'The server stopped unexpectedly and was restarted.' 'Warning'
  Start-Server
}

# --- updates -----------------------------------------------------------------
function Update-Check([bool]$announceNone = $false) {
  $script:nextUpdateCheck = (Get-Date).Add($UpdateCheckEvery)
  $fetch = Invoke-Hidden 'git.exe' 'fetch --quiet' 30000
  if ($fetch.Code -ne 0) {
    Write-TrayLog "git fetch failed: $($fetch.Out)"
    if ($announceNone) { Show-Balloon 'Case Calendar' 'Could not check for updates (offline?).' 'Warning' }
    return
  }
  $count = Invoke-Hidden 'git.exe' 'rev-list --count HEAD..@{u}' 10000
  $n = 0
  if ($count.Code -eq 0) { [void][int]::TryParse($count.Out, [ref]$n) }
  $script:pendingUpdates = $n
  Write-TrayLog "Update check: $n new change(s)"
  if ($n -gt 0) {
    $menuUpdate.Text = "Install update ($n new)"
    $menuUpdate.Enabled = $true
    if ($n -ne $script:lastNotifiedUpdates) {
      Show-Balloon 'Case Calendar update available' "$n new change(s). Right-click the tray icon > Install update."
      $script:lastNotifiedUpdates = $n
    }
  } else {
    $menuUpdate.Text = 'Install update (up to date)'
    $menuUpdate.Enabled = $false
    if ($announceNone) { Show-Balloon 'Case Calendar' 'You are up to date.' }
  }
}

function Start-Update {
  if ($script:updating) { return }
  $answer = [System.Windows.Forms.MessageBox]::Show(
    "Install $($script:pendingUpdates) update(s)?`n`nThe server stops, rebuilds, and restarts (about a minute). If anything fails, it rolls back to the current version.",
    'Case Calendar update', 'YesNo', 'Question')
  if ($answer -ne 'Yes') { return }
  Write-TrayLog 'Update requested'
  Set-Status 'updating...'
  $menuUpdate.Enabled = $false
  Stop-Server
  $psi = New-Object System.Diagnostics.ProcessStartInfo('powershell.exe',
    "-NoProfile -ExecutionPolicy Bypass -File `"$(Join-Path $PSScriptRoot 'update.ps1')`" -ProjectRoot `"$ProjectRoot`"")
  $psi.WorkingDirectory = $ProjectRoot
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  $script:updating = [System.Diagnostics.Process]::Start($psi)
  Show-Balloon 'Case Calendar' 'Updating... the server will be back in about a minute.'
}

function Test-Update {
  if (-not $script:updating -or -not $script:updating.HasExited) { return }
  $code = $script:updating.ExitCode
  $script:updating = $null
  Write-TrayLog "update.ps1 exited with $code"
  Start-Server
  switch ($code) {
    0 { Show-Balloon 'Case Calendar updated' 'Update installed and server restarted.' }
    3 { Show-Balloon 'Case Calendar' 'Already up to date.' }
    5 { Show-Balloon 'Update not installed' 'There are local changes to the app files. See logs\update.log.' 'Warning' }
    1 { Show-Balloon 'Update failed' 'Rolled back to the previous version. See logs\update.log.' 'Warning' }
    default { Show-Balloon 'Update failed' 'Rollback also failed; the server may not start. See logs\update.log.' 'Error' }
  }
  Update-Check
}

# --- other actions -------------------------------------------------------------
function Start-WallpaperRefresh {
  $psi = New-Object System.Diagnostics.ProcessStartInfo('cmd.exe', "/d /c npm run wallpaper:once >> `"$(Join-Path $LogsDir 'wallpaper-once.log')`" 2>&1")
  $psi.WorkingDirectory = $ProjectRoot
  $psi.UseShellExecute = $false
  $psi.CreateNoWindow = $true
  [void][System.Diagnostics.Process]::Start($psi)
  Show-Balloon 'Case Calendar' 'Refreshing wallpaper...'
}

function Exit-Tray {
  Write-TrayLog 'Quit requested'
  Stop-Server
  $timer.Stop()
  $notify.Visible = $false
  $notify.Dispose()
  [System.Windows.Forms.Application]::Exit()
}

# --- menu --------------------------------------------------------------------
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$menuOpen = $menu.Items.Add('Open Case Calendar')
$menuOpen.Font = New-Object System.Drawing.Font($menuOpen.Font, [System.Drawing.FontStyle]::Bold)
$menuOpen.add_Click({ Start-Process $AppUrl })
$menu.Items.Add('Refresh wallpaper now').add_Click({ Start-WallpaperRefresh })
[void]$menu.Items.Add('-')
$menu.Items.Add('Restart server').add_Click({ Restart-Server; Show-Balloon 'Case Calendar' 'Server restarted.' })
$menu.Items.Add('Check for updates').add_Click({ Update-Check $true })
$menuUpdate = $menu.Items.Add('Install update (checking...)')
$menuUpdate.Enabled = $false
$menuUpdate.add_Click({ Start-Update })
[void]$menu.Items.Add('-')
$menu.Items.Add('Open logs folder').add_Click({ Start-Process explorer.exe $LogsDir })
[void]$menu.Items.Add('-')
$menu.Items.Add('Quit (stops the server)').add_Click({ Exit-Tray })
$notify.ContextMenuStrip = $menu
$notify.add_DoubleClick({ Start-Process $AppUrl })

# --- main loop ---------------------------------------------------------------
$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 5000
$timer.add_Tick({
  try {
    Test-Update
    Test-Server
    if (-not $script:updating -and (Get-Date) -ge $script:nextUpdateCheck) { Update-Check }
  } catch {
    Write-TrayLog "timer error: $_"
  }
})

Write-TrayLog "Tray starting in $ProjectRoot"
Start-Server
$timer.Start()
[System.Windows.Forms.Application]::Run()
