# scripts/setup.ps1
#
# One-shot install + setup for Case Calendar v1.0 on Windows.
# Compatible with Windows PowerShell 5.1 (built-in on Windows 10/11) and PowerShell 7+.
#
# What this does:
#   1. Pre-flight checks (Node 22+, npm, git; warn on missing optional deps)
#   2. npm install
#   3. npm run build (Vite + tsc)
#   4. npm test  (full suite; aborts on failure unless -SkipTests)
#   5. Optional: bootstrap .env.local from .env.example with interactive prompts
#      (Phase 10 SMTP, Phase 11 Anthropic key, Phase 8 Tailscale hostname)
#   6. Optional: install Playwright Chromium (Phase 9 wallpaper worker)
#   7. Optional: install + start NSSM service as your user (Session 1+ for wallpaper)
#   8. Optional: configure Tailscale Serve (Phase 8 remote access)
#   9. Post-install verification (service status, /api/identity probe)
#
# Canonical invocation (run as Administrator for NSSM steps):
#   powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
#
# Or in an already-open PowerShell session (Set-ExecutionPolicy Bypass -Scope Process):
#   .\scripts\setup.ps1
#
# Flags:
#   -SkipTests           Skip 'npm test'
#   -SkipDbPush          Skip drizzle-kit schema push (assume schema already present)
#   -SkipPlaywright      Skip 'npx playwright install chromium' (~120MB download)
#   -SkipService         Skip NSSM service install (leave existing or run via 'npm run start')
#   -SkipEnvBootstrap    Skip .env.local prompt (assume already configured)
#   -SkipTailscale       Skip Tailscale Serve configuration
#   -ServiceName <name>  NSSM service name (default: CaseCalendar)
#   -LogonUser <user>    Pre-supply the service user (e.g. ".\yourusername")
#   -Unattended          Suppress all interactive prompts; assume defaults
#
# Idempotent: safe to re-run. Each step skips if its work is already done.

param(
  [switch]$SkipTests,
  [switch]$SkipDbPush,
  [switch]$SkipPlaywright,
  [switch]$SkipService,
  [switch]$SkipEnvBootstrap,
  [switch]$SkipTailscale,
  [string]$ServiceName = "CaseCalendar",
  [string]$LogonUser = "",
  [switch]$Unattended
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$ProjectRoot = (Resolve-Path "$PSScriptRoot\..").Path
Set-Location $ProjectRoot

# Detect which PowerShell to use for the nssm-install.ps1 sub-call.
# Prefer pwsh (PS7+) if available, fall back to powershell (PS5.1 built-in).
$PsExe = if (Get-Command pwsh -ErrorAction SilentlyContinue) { "pwsh" } else { "powershell" }

function Write-Step($msg) {
  Write-Host ""
  Write-Host "==> $msg" -ForegroundColor Cyan
}

function Write-Ok($msg) {
  Write-Host "    [ok] $msg" -ForegroundColor Green
}

function Write-Skip($msg) {
  Write-Host "    [skip] $msg" -ForegroundColor DarkGray
}

function Confirm-Continue($prompt, $defaultYes = $true) {
  if ($Unattended) { return $defaultYes }
  $suffix = if ($defaultYes) { "(Y/n)" } else { "(y/N)" }
  $answer = Read-Host "$prompt $suffix"
  if ($answer -eq "") { return $defaultYes }
  return ($answer -match '^[Yy]')
}

# ---------------------------------------------------------------------------
# Step 1: Pre-flight
# ---------------------------------------------------------------------------
Write-Step "Pre-flight checks"

# Node.js 22+
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "Node.js not found in PATH. Install Node 22 LTS from https://nodejs.org/en/download (Windows x64 MSI)."
  exit 1
}
$nodeVersion = (node --version) -replace '^v', ''
$nodeMajor = [int]($nodeVersion -split '\.')[0]
if ($nodeMajor -lt 22) {
  Write-Error "Node.js $nodeVersion detected; Case Calendar requires Node 22 LTS or newer."
  exit 1
}
Write-Ok "Node.js v$nodeVersion"

# npm
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Error "npm not found in PATH. Reinstall Node 22 LTS (npm ships with it)."
  exit 1
}
Write-Ok "npm $(npm --version)"

# git (optional)
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  Write-Warning "git not found in PATH. Recommended but not strictly required."
}

# NSSM (optional unless -SkipService is absent)
$hasNssm = $null -ne (Get-Command nssm -ErrorAction SilentlyContinue)
if ($hasNssm) {
  Write-Ok "NSSM found"
} elseif (-not $SkipService) {
  Write-Warning "NSSM not found. Service install will be skipped. Download from https://nssm.cc/download and add to PATH, then re-run."
  $SkipService = $true
}

# Tailscale (optional)
$hasTailscale = $null -ne (Get-Command tailscale -ErrorAction SilentlyContinue)
if ($hasTailscale) {
  Write-Ok "Tailscale found"
} elseif (-not $SkipTailscale) {
  Write-Skip "Tailscale not found. Install from https://tailscale.com/download/windows to enable phone/laptop reach."
  $SkipTailscale = $true
}

# Windows timezone
$tz = [System.TimeZoneInfo]::Local.Id
if ($tz -ne "Pacific Standard Time") {
  Write-Warning "System timezone is '$tz'; Case Calendar's date math assumes 'Pacific Standard Time'."
  if (-not (Confirm-Continue "Continue anyway?" $false)) {
    Write-Host "Aborted. Change Windows timezone in Settings > Time & language, then re-run."
    exit 1
  }
}

# ---------------------------------------------------------------------------
# Step 2: npm install
# ---------------------------------------------------------------------------
Write-Step "npm install"
$nodeModulesPkg = Join-Path $ProjectRoot "node_modules\.package-lock.json"
if (-not (Test-Path $nodeModulesPkg) -or (Get-Item "package.json").LastWriteTime -gt (Get-Item $nodeModulesPkg).LastWriteTime) {
  npm install
  if ($LASTEXITCODE -ne 0) { Write-Error "npm install failed"; exit 1 }
  Write-Ok "Dependencies installed"
} else {
  Write-Skip "node_modules already up to date"
}

# ---------------------------------------------------------------------------
# Step 3: npm run build
# ---------------------------------------------------------------------------
Write-Step "npm run build"
$distServer = Join-Path $ProjectRoot "dist\server\src\server\index.js"
$distClient = Join-Path $ProjectRoot "dist\client\index.html"
$buildStale = $true
if ((Test-Path $distServer) -and (Test-Path $distClient)) {
  $newestSource = (Get-ChildItem -Path "src" -Recurse -File | Sort-Object LastWriteTime -Descending | Select-Object -First 1).LastWriteTime
  $oldestArtifact = @((Get-Item $distServer).LastWriteTime, (Get-Item $distClient).LastWriteTime) | Sort-Object | Select-Object -First 1
  if ($newestSource -lt $oldestArtifact) { $buildStale = $false }
}
if ($buildStale) {
  npm run build
  if ($LASTEXITCODE -ne 0) { Write-Error "npm run build failed"; exit 1 }
  Write-Ok "Built dist/server + dist/client"
} else {
  Write-Skip "Build artifacts current"
}

# ---------------------------------------------------------------------------
# Step 3.5: drizzle-kit push
#
# drizzle-kit push is idempotent and fast (sub-second on the tiny SQLite file).
# No skip-detection by mtime is needed; the only reason to skip is when the
# user manages their schema out-of-band, in which case -SkipDbPush opts out.
# Must run BEFORE npm test (some tests touch the DB) and BEFORE service start.
# ---------------------------------------------------------------------------
Write-Step "db push (drizzle-kit)"
if (-not $SkipDbPush) {
  npm run db:push
  if ($LASTEXITCODE -ne 0) { Write-Error "drizzle-kit schema push failed"; exit 1 }
  Write-Ok "Schema pushed"
} else {
  Write-Skip "db push (per -SkipDbPush)"
}

# ---------------------------------------------------------------------------
# Step 4: npm test
# ---------------------------------------------------------------------------
if (-not $SkipTests) {
  Write-Step "npm test"
  npm test --silent
  if ($LASTEXITCODE -ne 0) {
    Write-Error "Test suite failed. Fix tests before installing the service."
    exit 1
  }
  Write-Ok "All tests passing"
} else {
  Write-Skip "npm test (per -SkipTests)"
}

# ---------------------------------------------------------------------------
# Step 5: .env.local bootstrap
# ---------------------------------------------------------------------------
$envLocal = Join-Path $ProjectRoot ".env.local"
$envExample = Join-Path $ProjectRoot ".env.example"
if (-not $SkipEnvBootstrap -and -not (Test-Path $envLocal)) {
  Write-Step ".env.local bootstrap"
  if (-not (Test-Path $envExample)) {
    Write-Warning ".env.example missing -- skipping bootstrap"
  } elseif (Confirm-Continue "Create .env.local from .env.example with interactive prompts?") {
    Copy-Item $envExample $envLocal
    Write-Ok "Copied .env.example -> .env.local"

    # Phase 8: Tailscale hostname
    if (-not $SkipTailscale -and $hasTailscale) {
      if (Confirm-Continue "Configure TAILSCALE_HOSTNAME now?" $false) {
        try {
          $tsStatus = tailscale status --json 2>$null | ConvertFrom-Json
          $tsHostname = $tsStatus.Self.DNSName.TrimEnd('.')
          Write-Host "    Detected tailnet hostname: $tsHostname"
          if (Confirm-Continue "Use this hostname?") {
            (Get-Content $envLocal) | ForEach-Object {
              if ($_ -match '^TAILSCALE_HOSTNAME=') { "TAILSCALE_HOSTNAME=$tsHostname" } else { $_ }
            } | Set-Content $envLocal
            Write-Ok "TAILSCALE_HOSTNAME=$tsHostname written"
          }
        } catch {
          Write-Warning "Could not auto-detect tailscale hostname; edit .env.local manually."
        }
      }
    }

    # Phase 10: SMTP digest
    if (Confirm-Continue "Configure SMTP for daily 7am email digest? (Gmail App Password recommended)" $false) {
      $smtpHost = Read-Host "  SMTP_HOST (default: smtp.gmail.com)"
      if ($smtpHost -eq "") { $smtpHost = "smtp.gmail.com" }
      $smtpPort = Read-Host "  SMTP_PORT (default: 587)"
      if ($smtpPort -eq "") { $smtpPort = "587" }
      $smtpUser = Read-Host "  SMTP_USER (your gmail address)"
      $smtpPassSecure = Read-Host "  SMTP_PASS (Gmail App Password, 16 chars no spaces)" -AsSecureString
      $smtpPassBSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($smtpPassSecure)
      $smtpPass = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($smtpPassBSTR)
      [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($smtpPassBSTR) | Out-Null
      $smtpTo = Read-Host "  SMTP_TO (recipient, usually same as SMTP_USER)"
      if ($smtpTo -eq "") { $smtpTo = $smtpUser }

      $envContent = Get-Content $envLocal
      $envContent = $envContent -replace '^SMTP_HOST=.*$', "SMTP_HOST=$smtpHost"
      $envContent = $envContent -replace '^SMTP_PORT=.*$', "SMTP_PORT=$smtpPort"
      $envContent = $envContent -replace '^SMTP_USER=.*$', "SMTP_USER=$smtpUser"
      $envContent = $envContent -replace '^SMTP_PASS=.*$', "SMTP_PASS=$smtpPass"
      $envContent = $envContent -replace '^SMTP_FROM=.*$', "SMTP_FROM=Case Calendar <$smtpUser>"
      $envContent = $envContent -replace '^SMTP_TO=.*$', "SMTP_TO=$smtpTo"
      $envContent = $envContent -replace '^EMAIL_DIGEST_ENABLED=.*$', "EMAIL_DIGEST_ENABLED=true"
      $envContent | Set-Content $envLocal
      Write-Ok "SMTP configured (digest will fire at next 7am LA-time after service start)"
    }

    # Phase 11: Anthropic API key
    if (Confirm-Continue "Configure ANTHROPIC_API_KEY for Cmd+K NL parser? (your typed text will be sent to Anthropic)" $false) {
      $anthropicSecure = Read-Host "  ANTHROPIC_API_KEY (starts with sk-ant-)" -AsSecureString
      $anthropicBSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($anthropicSecure)
      $anthropicKey = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($anthropicBSTR)
      [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($anthropicBSTR) | Out-Null

      $envContent = Get-Content $envLocal
      $envContent = $envContent -replace '^ANTHROPIC_API_KEY=.*$', "ANTHROPIC_API_KEY=$anthropicKey"
      $envContent | Set-Content $envLocal
      Write-Ok "ANTHROPIC_API_KEY configured"
    }

    # Lock down file permissions to current user only
    try {
      $acl = Get-Acl $envLocal
      $acl.SetAccessRuleProtection($true, $false)
      $rule = New-Object System.Security.AccessControl.FileSystemAccessRule(
        [System.Security.Principal.WindowsIdentity]::GetCurrent().Name,
        "FullControl", "Allow"
      )
      $acl.AddAccessRule($rule)
      Set-Acl -Path $envLocal -AclObject $acl
      Write-Ok ".env.local ACL: current user only"
    } catch {
      Write-Warning "Could not tighten .env.local ACL -- check Properties > Security manually."
    }
  } else {
    Write-Skip ".env.local bootstrap"
  }
} elseif (Test-Path $envLocal) {
  Write-Step ".env.local bootstrap"
  Write-Skip ".env.local already exists"
}

# ---------------------------------------------------------------------------
# Step 6: Playwright Chromium (Phase 9 wallpaper)
# ---------------------------------------------------------------------------
if (-not $SkipPlaywright) {
  $wallpaperEnabled = $false
  if (Test-Path $envLocal) {
    $wallpaperEnabled = (Select-String -Path $envLocal -Pattern '^WALLPAPER_ENABLED=true$' -Quiet)
  }
  if (-not $wallpaperEnabled) {
    Write-Step "Playwright Chromium install (Phase 9 wallpaper worker)"
    Write-Skip "Wallpaper disabled (set WALLPAPER_ENABLED=true in .env.local to enable)"
  } else {
    Write-Step "Playwright Chromium install (Phase 9 wallpaper worker)"
    $playwrightCacheDir = Join-Path $env:USERPROFILE "AppData\Local\ms-playwright"
    if (Test-Path $playwrightCacheDir) {
      Write-Skip "Playwright cache already present at $playwrightCacheDir"
    } elseif (Confirm-Continue "Download Chromium for wallpaper rendering? (~120MB)") {
      npx playwright install chromium
      if ($LASTEXITCODE -ne 0) {
        Write-Warning "Playwright install failed. Wallpaper worker will fail to launch until you run: npx playwright install --with-deps chromium"
      } else {
        Write-Ok "Chromium installed"
      }
    } else {
      Write-Skip "Playwright Chromium (wallpaper worker will be disabled until installed)"
    }
  }
} else {
  Write-Skip "Playwright Chromium (per -SkipPlaywright)"
}

# ---------------------------------------------------------------------------
# Step 7: NSSM service
# ---------------------------------------------------------------------------
if (-not $SkipService) {
  Write-Step "NSSM service install"
  $principal = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
  if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Error "Administrator rights required to install the Windows service. Close this terminal, right-click PowerShell (or Windows Terminal), choose 'Run as Administrator', and re-run .\scripts\setup.ps1. To skip the service install entirely, re-run with -SkipService."
    exit 1
  }
  if ($LogonUser -eq "") {
    Write-Host "    For Phase 9 wallpaper apply, the service MUST run as your interactive user (not LocalSystem)."
    Write-Host "    Your username: $env:USERNAME"
    if (Confirm-Continue "Install service as '.\$env:USERNAME' (recommended)?") {
      $LogonUser = ".\$env:USERNAME"
    } else {
      Write-Warning "Installing as LocalSystem. Wallpaper apply will silently fail until you re-run with -LogonUser."
    }
  }

  $nssmArgs = @("-ExecutionPolicy", "Bypass", "-File", "$PSScriptRoot\nssm-install.ps1", "-ServiceName", $ServiceName)
  if ($LogonUser -ne "") { $nssmArgs += @("-LogonUser", $LogonUser) }

  & $PsExe @nssmArgs
  if ($LASTEXITCODE -ne 0) {
    Write-Error "NSSM install failed."
    exit 1
  }
  Write-Ok "Service $ServiceName installed (not yet started)"

  if (Confirm-Continue "Start $ServiceName now?") {
    nssm start $ServiceName
    Start-Sleep -Seconds 3
    $svcStatus = nssm status $ServiceName
    if ($svcStatus -match 'SERVICE_RUNNING') {
      Write-Ok "Service running on http://127.0.0.1:3747"
    } else {
      Write-Warning "Service status: $svcStatus -- check logs at $ProjectRoot\logs\"
    }
  }
} else {
  Write-Skip "NSSM service (per -SkipService; run via 'npm run start' instead)"
}

# ---------------------------------------------------------------------------
# Step 8: Tailscale Serve (Phase 8 remote access)
# ---------------------------------------------------------------------------
if (-not $SkipTailscale -and $hasTailscale) {
  Write-Step "Tailscale Serve (Phase 8 remote access)"
  $tsServeStatus = tailscale serve status 2>$null
  if ($tsServeStatus -match '127\.0\.0\.1:3747') {
    Write-Skip "Tailscale Serve already proxying to 127.0.0.1:3747"
  } elseif (Confirm-Continue "Enable Tailscale Serve so your phone + laptop on the tailnet can reach the app?") {
    tailscale serve --bg http://127.0.0.1:3747
    if ($LASTEXITCODE -eq 0) {
      Write-Ok "Tailscale Serve enabled (persists across reboots)"
      tailscale serve status
    } else {
      Write-Warning "Tailscale Serve failed. Make sure you are logged in (tailscale up) and on an active tailnet."
    }
  } else {
    Write-Skip "Tailscale Serve"
  }
}

# ---------------------------------------------------------------------------
# Step 9: Post-install verification
# ---------------------------------------------------------------------------
Write-Step "Post-install verification"

# Listening port check
$listening = netstat -ano | Select-String '127\.0\.0\.1:3747.*LISTENING'
if ($listening) {
  Write-Ok "Hono listening on 127.0.0.1:3747"
} else {
  Write-Warning "Nothing listening on 127.0.0.1:3747 yet -- start the service or run 'npm run start'."
}

# /api/identity probe (only if service running)
if ($listening) {
  try {
    $resp = Invoke-RestMethod -Uri "http://127.0.0.1:3747/api/identity" -Method Get -TimeoutSec 5
    Write-Ok "/api/identity returns: user='$($resp.user)'"
  } catch {
    Write-Warning "/api/identity probe failed: $($_.Exception.Message)"
  }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host " Case Calendar v1.0 setup complete" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Green
Write-Host ""
Write-Host " Open in browser:    http://127.0.0.1:3747"
if (-not $SkipTailscale -and $hasTailscale) {
  try {
    $tsName = (tailscale status --json 2>$null | ConvertFrom-Json).Self.DNSName.TrimEnd('.')
    if ($tsName) { Write-Host " Remote (tailnet):   http://$tsName" }
  } catch {}
}
Write-Host " Manual digest:      npm run email:once"
Write-Host " Manual wallpaper:   npm run wallpaper:once"
Write-Host " Manual NL parse:    npm run parse:once `"Smith deposition June 15`""
Write-Host ""
Write-Host " Service status:     nssm status $ServiceName"
Write-Host " Tail logs:          Get-Content -Wait $ProjectRoot\logs\case-calendar.log"
Write-Host " Full runbook:       docs\DEPLOYMENT.md"
Write-Host ""
