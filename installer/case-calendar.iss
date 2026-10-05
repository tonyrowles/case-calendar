; installer/case-calendar.iss -- Inno Setup 6 script for CaseCalendarSetup-<version>.exe
;
; Built by scripts/package-release.ps1, which stages the files and passes
;   /DAppVersion=<x.y.z> /DStageDir=<release\stage> /DOutputDir=<release>
;
; Per-user install (no administrator rights): %LOCALAPPDATA%\Programs\Case Calendar
;   app\   server, web app, runtime scripts     node\  bundled node.exe
; User data lives in %LOCALAPPDATA%\CaseCalendar and is never touched by upgrades or
; uninstall. The tray starts at logon via the HKCU Run key and after install.
; Silent upgrade (tray "Install update"): /VERYSILENT /SUPPRESSMSGBOXES /NORESTART
; /NOLAUNCH=1 skips starting the tray (CI smoke test).

#ifndef AppVersion
  #error AppVersion is required (/DAppVersion=x.y.z)
#endif

; Single-quoted ISPP string: the doubled quotes stay doubled, which is what Inno's quoted
; Parameters/ValueData values need for a literal quote around the path
#define TrayCmd '--headless powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File ""{app}\app\scripts\tray.ps1""'

[Setup]
AppId={{6F3C2B1E-9A47-4C8D-B5E2-3D1F0A7C9E64}
AppName=Case Calendar
AppVersion={#AppVersion}
AppVerName=Case Calendar {#AppVersion}
AppPublisher=Case Calendar
DefaultDirName={localappdata}\Programs\Case Calendar
DisableDirPage=yes
DisableProgramGroupPage=yes
DisableReadyPage=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0.17763
OutputDir={#OutputDir}
OutputBaseFilename=CaseCalendarSetup-{#AppVersion}
SetupIconFile={#StageDir}\app\case-calendar.ico
UninstallDisplayIcon={app}\app\case-calendar.ico
UninstallDisplayName=Case Calendar
Compression=lzma2/max
SolidCompression=yes
WizardStyle=modern
CloseApplications=no
RestartApplications=no

[Messages]
FinishedLabelNoIcons=Case Calendar is installed and running. Look for the calendar icon in the system tray; your browser opens to Settings to finish setup.

[InstallDelete]
; Replace the program files wholesale on upgrade (no stale node_modules); data is elsewhere
Type: filesandordirs; Name: "{app}\app"
Type: filesandordirs; Name: "{app}\node"

[Files]
Source: "{#StageDir}\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{autoprograms}\Case Calendar"; Filename: "{sys}\conhost.exe"; Parameters: "{#TrayCmd} -Open"; WorkingDir: "{app}\app"; IconFilename: "{app}\app\case-calendar.ico"; Comment: "Open Case Calendar"

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; ValueType: string; ValueName: "CaseCalendar"; ValueData: """{sys}\conhost.exe"" {#TrayCmd}"; Flags: uninsdeletevalue

[Run]
; Fresh install: open Settings so setup can be finished. Upgrade: start quietly.
Filename: "{sys}\conhost.exe"; Parameters: "{#TrayCmd} -Open -OpenPath /settings"; WorkingDir: "{app}\app"; Flags: nowait runhidden; Check: ShouldLaunch and IsFreshInstall
Filename: "{sys}\conhost.exe"; Parameters: "{#TrayCmd}"; WorkingDir: "{app}\app"; Flags: nowait runhidden; Check: ShouldLaunch and not IsFreshInstall

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -File ""{app}\app\scripts\stop.ps1"""; Flags: runhidden waituntilterminated; RunOnceId: "StopCaseCalendar"

[Code]
var
  WasInstalled: Boolean;

function IsFreshInstall: Boolean;
begin
  Result := not WasInstalled;
end;

function ShouldLaunch: Boolean;
begin
  Result := ExpandConstant('{param:NOLAUNCH|0}') <> '1';
end;

// Stop the running tray and server so their files can be replaced
function PrepareToInstall(var NeedsRestart: Boolean): String;
var
  StopScript: String;
  Code: Integer;
begin
  Result := '';
  StopScript := ExpandConstant('{app}\app\scripts\stop.ps1');
  WasInstalled := FileExists(StopScript);
  if WasInstalled then
    Exec('powershell.exe', '-NoProfile -ExecutionPolicy Bypass -File "' + StopScript + '"', '', SW_HIDE, ewWaitUntilTerminated, Code);
end;
