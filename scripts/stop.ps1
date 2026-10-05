# scripts/stop.ps1
#
# Stop a running Case Calendar: the tray (any PowerShell process running tray.ps1) and
# whatever listens on port 3747 (the server). The installer runs this before upgrading or
# uninstalling so no files are in use.
#
# ASCII only: Windows PowerShell 5.1 misreads non-ASCII in BOM-less scripts.

$ErrorActionPreference = 'SilentlyContinue'
$Port = 3747

# Only processes RUNNING tray.ps1 (-File <path>\tray.ps1), not ones that merely mention it:
# install-update.ps1 gets the tray path as -TrayScript and must survive the upgrade
$TrayRunning = '-File\s+"?[^"]*\\tray\.ps1"?(\s|$)'
Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
  Where-Object { $_.CommandLine -and $_.CommandLine -match $TrayRunning -and $_.ProcessId -ne $PID } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

Get-NetTCPConnection -LocalPort $Port -State Listen |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { & taskkill.exe /PID $_ /T /F | Out-Null }

# Give Windows a moment to release file handles
Start-Sleep -Milliseconds 800
exit 0
