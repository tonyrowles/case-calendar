# scripts/package-release.ps1
#
# Build the Windows installer: release\CaseCalendarSetup-<version>.exe
#
#   1. npm run build
#   2. stage release\stage\  (what gets installed):
#        app\   server.mjs (the server + its libraries, bundled by esbuild), dist\client (web
#               app), node_modules with only better-sqlite3 + playwright-core, runtime
#               scripts, release.json
#        node\  node.exe (the same Node that built the native better-sqlite3 addon)
#   3. compile installer\case-calendar.iss with Inno Setup 6 (ISCC.exe)
#
# Used by .github/workflows/release.yml; also works locally with Inno Setup installed
# (winget install JRSoftware.InnoSetup). -SkipInstaller stops after staging.
#
# ASCII only: Windows PowerShell 5.1 misreads non-ASCII in BOM-less scripts.

[CmdletBinding()]
param(
  [switch]$SkipBuild,
  [switch]$SkipInstaller,
  # GitHub owner/name that installed copies check for updates; default: this build's repo
  [string]$Repo = ''
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root
$Release = Join-Path $Root 'release'
$Stage = Join-Path $Release 'stage'
$App = Join-Path $Stage 'app'

function Invoke-Checked([string]$label, [scriptblock]$cmd) {
  Write-Host "==> $label"
  & $cmd
  if ($LASTEXITCODE -ne 0) { throw "$label failed (exit code $LASTEXITCODE)" }
}

$pkg = Get-Content (Join-Path $Root 'package.json') -Raw | ConvertFrom-Json
if (-not $Repo) { $Repo = $env:GITHUB_REPOSITORY }
if (-not $Repo) {
  $origin = (git remote get-url origin 2>$null)
  if ($origin -match 'github\.com[:/]([^/]+/[^/]+?)(\.git)?$') { $Repo = $Matches[1] }
}
if (-not $Repo) { throw 'Could not tell which GitHub repo updates come from; pass -Repo owner/name' }
Write-Host "Updates from github.com/$Repo"
$Version = $pkg.version
Write-Host "Case Calendar $Version"

if (-not $SkipBuild) { Invoke-Checked 'npm run build' { npm run build } }
if (-not (Test-Path 'dist\server\src\server\index.js') -or -not (Test-Path 'dist\client\index.html')) {
  throw 'dist\ is missing; run npm run build'
}

# --- stage ---------------------------------------------------------------------
if (Test-Path $Stage) { [System.IO.Directory]::Delete($Stage, $true) }
New-Item -ItemType Directory -Force -Path $App, (Join-Path $Stage 'node'), (Join-Path $App 'scripts'), (Join-Path $App 'dist') | Out-Null

# The web app is prebuilt (dist\client); React, Vite, Tailwind etc. are not needed at runtime
Copy-Item -Recurse 'dist\client' (Join-Path $App 'dist\client')
Copy-Item 'package-lock.json' $App
foreach ($s in 'tray.ps1', 'install-update.ps1', 'stop.ps1', 'wallpaper-set.ps1', 'wallpaper-com.ps1', 'monitors.ps1') {
  Copy-Item (Join-Path 'scripts' $s) (Join-Path $App 'scripts')
}

# The server and every library it uses, as one minified file (only the code actually
# reached). Kept outside the bundle: better-sqlite3 (native .node addon) and
# playwright-core (spawns its own driver files). The banner gives the ESM bundle the
# CommonJS globals some bundled libraries use (node-cron reads __dirname).
$External = @('better-sqlite3', 'playwright-core')
$banner = "import{createRequire as __cr}from'node:module';import{fileURLToPath as __fu}from'node:url';import{dirname as __dn}from'node:path';const require=__cr(import.meta.url);const __filename=__fu(import.meta.url);const __dirname=__dn(__filename);"
$esbuildArgs = @('src/server/index.ts', '--bundle', '--platform=node', '--format=esm', '--target=node22', '--minify',
  '--legal-comments=external', "--outfile=$(Join-Path $App 'server.mjs')", "--banner:js=$banner", '--log-level=warning') +
  ($External | ForEach-Object { "--external:$_" })
Invoke-Checked 'esbuild server bundle' { npx --no-install esbuild @esbuildArgs }

$deps = [ordered]@{}
foreach ($name in $External) {
  $range = $pkg.dependencies.PSObject.Properties[$name]
  if (-not $range) { throw "'$name' is not in package.json dependencies" }
  $deps[$name] = $range.Value
}
$runtimePkg = [ordered]@{
  name = $pkg.name; version = $pkg.version; private = $true; type = 'module'
  dependencies = $deps
  allowScripts = $pkg.allowScripts
}
$runtimePkg | ConvertTo-Json -Depth 5 | Set-Content -Encoding ASCII (Join-Path $App 'package.json')

Push-Location $App
try {
  # npm install (not ci): package.json is a subset of the lockfile, which npm prunes to match;
  # versions stay pinned by the lockfile
  Invoke-Checked 'npm install --omit=dev' { npm install --omit=dev --no-audit --no-fund }
} finally { Pop-Location }

# better-sqlite3 needs only its JS (lib\) and the compiled addon; drop the SQLite C
# sources and build intermediates (~10 MB)
$bs = Join-Path $App 'node_modules\better-sqlite3'
foreach ($d in 'deps', 'src') { if (Test-Path (Join-Path $bs $d)) { [System.IO.Directory]::Delete((Join-Path $bs $d), $true) } }
Get-ChildItem (Join-Path $bs 'build') -Recurse -File | Where-Object { $_.Extension -ne '.node' } | ForEach-Object { [System.IO.File]::Delete($_.FullName) }
if (-not (Get-ChildItem (Join-Path $bs 'build') -Recurse -Filter *.node)) { throw 'better-sqlite3 native addon missing after install' }

# Same node.exe that compiled better-sqlite3 above (ABI must match)
$node = (Get-Command node).Source
Copy-Item $node (Join-Path $Stage 'node\node.exe')
Write-Host "Bundled $node ($(node --version))"

@{ version = $Version; repo = $Repo; node = (node --version); builtAt = (Get-Date).ToUniversalTime().ToString('o') } |
  ConvertTo-Json | Set-Content -Encoding ASCII (Join-Path $App 'release.json')

# --- icon (same calendar as the tray icon, drawn at 256 px, PNG-in-ICO) -----------
Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap 256, 256
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.ScaleTransform(8, 8)
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
$png = New-Object System.IO.MemoryStream
$bmp.Save($png, [System.Drawing.Imaging.ImageFormat]::Png)
$pngBytes = $png.ToArray()
$ico = New-Object System.IO.MemoryStream
$w = New-Object System.IO.BinaryWriter $ico
$w.Write([uint16]0); $w.Write([uint16]1); $w.Write([uint16]1)            # ICONDIR: reserved, type=icon, count=1
$w.Write([byte]0); $w.Write([byte]0); $w.Write([byte]0); $w.Write([byte]0) # 256x256 (0 = 256), no palette
$w.Write([uint16]1); $w.Write([uint16]32)                                  # planes, bits per pixel
$w.Write([uint32]$pngBytes.Length); $w.Write([uint32]22)                   # size, offset
$w.Write($pngBytes)
$w.Flush()
[System.IO.File]::WriteAllBytes((Join-Path $App 'case-calendar.ico'), $ico.ToArray())

$size = (Get-ChildItem -Recurse -File $Stage | Measure-Object -Sum Length).Sum
Write-Host ("Staged {0:N0} MB in {1}" -f ($size / 1MB), $Stage)

if ($SkipInstaller) { exit 0 }

# --- installer -----------------------------------------------------------------
$iscc = (Get-Command iscc.exe -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source -First 1)
if (-not $iscc) {
  foreach ($p in "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:ProgramFiles\Inno Setup 6\ISCC.exe", "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe") {
    if (Test-Path $p) { $iscc = $p; break }
  }
}
if (-not $iscc) { throw 'Inno Setup 6 not found (winget install JRSoftware.InnoSetup), or use -SkipInstaller' }
Invoke-Checked 'ISCC' { & $iscc "/DAppVersion=$Version" "/DStageDir=$Stage" "/DOutputDir=$Release" (Join-Path $Root 'installer\case-calendar.iss') }
Write-Host "Built $(Join-Path $Release "CaseCalendarSetup-$Version.exe")"
