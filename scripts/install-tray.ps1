# scripts/install-tray.ps1
#
# Register (or re-register) the "CaseCalendar" scheduled task so the tray app
# (scripts/tray.ps1) starts hidden at logon, then start it now. Replaces the older
# "cmd /c npm run start" task from docs/DEPLOYMENT.md. No Administrator needed.
#
#   powershell -ExecutionPolicy Bypass -File .\scripts\install-tray.ps1
#   powershell -ExecutionPolicy Bypass -File .\scripts\install-tray.ps1 -Uninstall
#
# If NSSM installed a CaseCalendar *service*, remove it first (Administrator):
#   nssm stop CaseCalendar; nssm remove CaseCalendar confirm
#
# ASCII only: Windows PowerShell 5.1 misreads non-ASCII in BOM-less scripts.

[CmdletBinding()]
param(
  [string]$TaskName = 'CaseCalendar',
  [switch]$Uninstall
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ProjectRoot = Split-Path -Parent $PSScriptRoot
$TrayScript = Join-Path $PSScriptRoot 'tray.ps1'
$Port = 3747

function Stop-Existing {
  if (Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue) {
    Stop-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
    Write-Host "Removed existing '$TaskName' task"
  }
  # Stop-ScheduledTask ends the task's top process but can leave node running;
  # also close a running tray (its mutex keeps a second copy from starting).
  Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
    Where-Object { $_.CommandLine -and $_.CommandLine -like '*scripts\tray.ps1*' } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
  Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique |
    ForEach-Object { & taskkill.exe /PID $_ /T /F | Out-Null }
}

if ($Uninstall) {
  Stop-Existing
  Write-Host 'Case Calendar tray uninstalled. (Data in data\ is untouched.)'
  exit 0
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) { throw 'node not found on PATH. Install Node 22 LTS first.' }
if (-not (Test-Path (Join-Path $ProjectRoot 'dist\server\src\server\index.js'))) {
  throw "Server not built. Run 'npm run build' in $ProjectRoot first (or scripts\setup.ps1 -SkipService)."
}
if (Get-Service -Name $TaskName -ErrorAction SilentlyContinue) {
  Write-Warning "A '$TaskName' Windows service (NSSM) exists. Remove it first (Administrator): nssm stop $TaskName; nssm remove $TaskName confirm"
  exit 1
}

Stop-Existing

$user = "$env:USERDOMAIN\$env:USERNAME"
$action = New-ScheduledTaskAction -Execute 'powershell.exe' `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -STA -File `"$TrayScript`"" `
  -WorkingDirectory $ProjectRoot
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $user
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
# ExecutionTimeLimit 0 = no limit. The default (72 hours) would kill the tray + server after 3 days.
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
  -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings | Out-Null
Write-Host "Registered '$TaskName' task: tray starts at logon for $user"

Start-ScheduledTask -TaskName $TaskName
$listening = $false
for ($i = 0; $i -lt 40; $i++) {
  if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) { $listening = $true; break }
  Start-Sleep -Milliseconds 500
}
if ($listening) {
  Write-Host "Case Calendar is running at http://127.0.0.1:$Port -- look for the calendar icon in the system tray."
  Write-Host '(On Windows 11 it may be under the ^ overflow arrow; drag it onto the taskbar to keep it visible.)'
} else {
  Write-Warning "Server did not start within 20s. Check $ProjectRoot\logs\tray.log and logs\case-calendar.log"
  exit 1
}
