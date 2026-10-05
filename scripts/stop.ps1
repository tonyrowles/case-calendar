# scripts/stop.ps1
#
# Stop a running Case Calendar: the tray (any tray.ps1 PowerShell process) and whatever
# listens on port 3747 (the server). The installer runs this before upgrading or
# uninstalling so no files are in use.
#
# ASCII only: Windows PowerShell 5.1 misreads non-ASCII in BOM-less scripts.

$ErrorActionPreference = 'SilentlyContinue'
$Port = 3747

Get-CimInstance Win32_Process -Filter "Name='powershell.exe'" |
  Where-Object { $_.CommandLine -and $_.CommandLine -like '*tray.ps1*' -and $_.ProcessId -ne $PID } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force }

Get-NetTCPConnection -LocalPort $Port -State Listen |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { & taskkill.exe /PID $_ /T /F | Out-Null }

# Give Windows a moment to release file handles
Start-Sleep -Milliseconds 800
exit 0
