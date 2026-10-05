# Self-host on Windows

Most people should use the installer (see the README): `CaseCalendarSetup-<version>.exe`
installs per-user with its own Node, keeps data in `%LOCALAPPDATA%\CaseCalendar`, runs from the
tray, and updates itself from GitHub Releases. Everything below is for running from a git
checkout (development, or the original NSSM service setup).

## Installer and releases

- `scripts/package-release.ps1` builds `release\CaseCalendarSetup-<version>.exe`: esbuild bundles
  the server and its libraries into one minified `server.mjs`; only better-sqlite3 (native
  addon, C sources stripped) and playwright-core ship as packages (installed against the
  lockfile). It copies the current `node.exe` (it must match the Node that compiled
  better-sqlite3) and compiles `installer/case-calendar.iss` with Inno Setup 6
  (`winget install JRSoftware.InnoSetup`). `-SkipInstaller` stops after staging. About 105 MB
  installed (85% of it node.exe), about 27 MB to download.
- `.github/workflows/release.yml` does the same on a clean runner, installs the result silently,
  smoke-tests the installed server (first run with an empty data folder), uninstalls, and on a
  version tag publishes a GitHub Release. Cut a release with `npm version minor` then
  `git push --follow-tags`.
- Installed layout: `%LOCALAPPDATA%\Programs\Case Calendar\{app,node}`; data, logs and an
  optional `.env.local` in `%LOCALAPPDATA%\CaseCalendar` (`CASE_CALENDAR_DATA`). The tray starts
  at sign-in via `HKCU\...\Run\CaseCalendar`.
- Updates: the tray checks `releases/latest` every 6 hours and runs `install-update.ps1`, which
  downloads the new installer and runs it silently. The repository must be public for this
  check (and the download) to work without credentials.
- The wallpaper uses Playwright's Chromium when present, otherwise the Microsoft Edge built
  into Windows, so the installer does not ship a browser.
- The database schema is created at startup (`src/server/schema-init.ts`); new columns need an
  `ALTER TABLE` there so existing installs pick them up.

---

Cold-start runbook for deploying Case Calendar from a checkout as a Windows service that survives reboot.

---

## Quick Path

1. Administrator PowerShell: `.\scripts\setup.ps1` walks through pre-flight, build, db push, tests, optional .env.local bootstrap, NSSM install, post-install probe.
2. Open `http://127.0.0.1:3747`.

Defaults: NSSM installs as **LocalSystem** unless you choose your own user (LocalSystem needs no stored password); **WALLPAPER_ENABLED=false** -- Phase 9 wallpaper is off until you opt in; Phase 10 email and Phase 11 NL parser are off until you fill in `.env.local`.

PIN-only or Microsoft Account sign-in (no local password)? Skip NSSM and use the [Task Scheduler Alternative (no stored password)](#task-scheduler-alternative-no-stored-password) -- runs the server in your user session and also fixes the Phase 9 wallpaper Session 0 problem for free.

---

## Prerequisites

- **Node.js 22 LTS** (`node --version`) -- nodejs.org.
- **NSSM 2.24+** (`nssm version`) -- nssm.cc/download; place `nssm.exe` on `PATH`.
- **Admin PowerShell** -- right-click -> **Run as Administrator**. Fallback: `npm run start` in a normal terminal (no service, no auto-restart).
- **Windows timezone = `Pacific Standard Time`** (`[System.TimeZoneInfo]::Local.Id`). If different, the install script warns and prompts. All `today` calculations and backup retention use this timezone.

---

## Install

`scripts\setup.ps1` is the supported, idempotent install path. From Administrator PowerShell:

```powershell
git clone <repo> C:\apps\case-calendar
cd C:\apps\case-calendar
powershell -ExecutionPolicy Bypass -File .\scripts\setup.ps1
```

What setup.ps1 does:

1. **Pre-flight** -- Node 22 LTS, npm, git, NSSM, Tailscale, Windows timezone.
2. **npm install** -- skipped if `node_modules/.package-lock.json` newer than `package.json`.
3. **npm run build** -- skipped only when dist is newer than `src/**` AND `dist/client/index.html` references `/assets/index-` (catches test-fixture stubs).
4. **db push** -- `npm run db:push` (drizzle-kit). Sub-second. `-SkipDbPush` skips.
5. **npm test** -- Vitest. `-SkipTests` skips.
6. **.env.local bootstrap** (optional) -- prompts for SMTP, Anthropic, Tailscale.
7. **Playwright Chromium** -- ONLY when `WALLPAPER_ENABLED=true`; else skipped.
8. **NSSM service** -- Administrator pre-check. Prompts to install as `.\<your-username>` or LocalSystem. `-SkipService` skips.
9. **Tailscale Serve** (optional).
10. **Verify** -- netstat for `127.0.0.1:3747` + `/api/identity` probe.

**Manual path:** `npm install; npm run build; npm run db:push`; optional `.env.local`; optional `npx playwright install chromium` (only if `WALLPAPER_ENABLED=true`); `pwsh -ExecutionPolicy Bypass -File .\scripts\nssm-install.ps1` from Administrator PowerShell; `nssm start CaseCalendar`. `nssm-install.ps1` has its own Administrator pre-check and `Invoke-Nssm` helper gating every `nssm install`/`set` call on exit code -- silent failures no longer reach the success message.

Re-running is safe: steps short-circuit if done; NSSM script removes any prior service before installing fresh.

---

## Verify

After `nssm start CaseCalendar`:

```powershell
nssm status CaseCalendar                                                          # SERVICE_RUNNING
netstat -ano | findstr 3747                                                       # 127.0.0.1:3747 (NOT 0.0.0.0)
(Invoke-WebRequest http://127.0.0.1:3747 -UseBasicParsing).StatusCode             # 200
(Invoke-WebRequest http://127.0.0.1:3747/api/deadlines -UseBasicParsing).Content  # JSON
Get-Content C:\apps\case-calendar\logs\case-calendar.log -Tail 20                 # "Server listening on http://127.0.0.1:3747"
```

Open `http://127.0.0.1:3747` -- SPA loads, deadlines view renders.

---

## Post-Install Reboot Verification (OPS-04)

Restart Windows. After login, open `http://127.0.0.1:3747` **without launching anything manually**. If the page loads, OPS-04 passes -- the NSSM service started at boot via `Start=SERVICE_AUTO_START`.

---

## Update Procedure

```powershell
nssm stop CaseCalendar; cd C:\apps\case-calendar; git pull; npm install; npm run build; nssm start CaseCalendar
```

Verify with the Verify section above.

---

## Troubleshoot

**Service won't start / restart loop** -- usually `dist\server\src\server\index.js` missing/corrupted. `Get-Content C:\apps\case-calendar\logs\case-calendar.err -Tail 30`. If `Cannot find module`, `npm run build; nssm restart CaseCalendar`. NSSM restart-loops on non-zero Node exit; 10MB log rotation (`AppRotateBytes`) prevents disk exhaustion.

**Bound to wrong port/address** -- if `netstat -ano | findstr 3747` shows `0.0.0.0:3747`, SAFE-07 regressed. `hostname` in `src/server/index.ts` must be `'127.0.0.1'`. Reproduce: `cross-env TZ=America/Los_Angeles npm test -- tests/safe-07-bind-loopback.test.ts`.

**Logs not appearing** -- confirm `logs\` exists and the service account (LocalSystem by default) has write permission. Install under `C:\apps\`, not `C:\Program Files\` (UAC-restricted write).

### Common symptoms

| Symptom | Cause / Fix |
|---------|-------------|
| `Service did not start due to a logon failure` | PIN/Microsoft Account sign-in -- no stored Windows password. Use [Task Scheduler](#task-scheduler-alternative-no-stored-password); for NSSM `-LogonUser`, set a local password first (`net user $env:USERNAME *`) and reinstall. |
| `SqliteError: no such table: deadline_types` | Drizzle schema not pushed -- `npm run db:push`. `setup.ps1` Step 3.5 does this. |
| Blank page despite server 200 | Stale/test-fixture `dist/client/index.html` past mtime check -- `Remove-Item -Recurse -Force dist; npm run build`. `setup.ps1` now also checks `/assets/index-` references. |
| NSSM `Can't open service!` / `OpenService(): Access is denied.` | Non-elevated PowerShell -- right-click -> **Run as Administrator**. Both scripts now have an Administrator pre-check. |
| `Administrator rights required to install the Windows service.` | Same as above. |
| `nssm <verb> ... failed with exit code N` from `Invoke-Nssm` | NSSM rejected the call -- read the preceding `nssm` stderr line for the failing verb/argument. |

---

## Uninstall

```powershell
nssm stop CaseCalendar; nssm remove CaseCalendar confirm
Remove-Item -Recurse -Force C:\apps\case-calendar   # optional
```

SQLite DB lives in `data\deadlines.db` -- move it somewhere safe first if you want to keep deadline history.

---

## Remote Access via Tailscale

Tailscale Serve proxies tailnet traffic to the loopback Hono server -- no public exposure, no source changes. *Hono binds `127.0.0.1:3747` only; Tailscale Serve is a same-host proxy, SAFE-07 preserved.*

**Prerequisites:** Tailscale on host AND client (https://tailscale.com/download), same tailnet. NSSM service installed and running.

### Enable Tailscale Serve

Persists across reboots ([tailscale.com/kb/1312/serve](https://tailscale.com/kb/1312/serve)). From Administrator PowerShell:

```powershell
tailscale serve --bg http://127.0.0.1:3747
tailscale serve status   # one proxy entry mapping tailnet hostname to http://127.0.0.1:3747
```

Copy the tailnet hostname (e.g. `lawyer-laptop.tail-scale.ts.net`) -- hostname only, no scheme, no port.

### Configure CORS for the Tailscale Origin

Browsers send `Origin: http://<your-tailnet-hostname>`; the CORS allowlist must include it:

```powershell
nssm set CaseCalendar AppEnvironmentExtra "TZ=America/Los_Angeles" "NODE_ENV=production" "TAILSCALE_HOSTNAME=lawyer-laptop.tail-scale.ts.net"
nssm restart CaseCalendar
```

> **Warning:** hostname **only** (no `http://`, port, or slash). The server appends schemes; including one produces `http://http://...` and CORS errors. After any change, restart the service -- env vars are read once at start.

### Verify Remote Access

From the **client device**: `http://<your-tailnet-hostname>` loads; `/api/identity` returns `{"user":"<your-tailnet-email>"}` confirming `Tailscale-User-Login` injection. (Direct loopback from host returns `{"user":"local"}` -- expected; header only on the proxy path.) On host: `Get-Content C:\apps\case-calendar\logs\case-calendar.log -Tail 20 | Select-String "tailscale"` -- expect `cors: tailscale origins allowed (http + https)`.

**Optional HTTPS:** HTTP over the tailnet is WireGuard-encrypted; "Not Secure" is cosmetic ([tailscale.com/kb/1153](https://tailscale.com/kb/1153/enabling-https)). For HTTPS in the address bar: `tailscale serve off; tailscale serve --bg --https=443 http://127.0.0.1:3747` (requires HTTPS feature in tailnet admin panel; auto-renews).

### Troubleshooting

| Symptom | Cause / Fix |
|---------|-------------|
| CORS errors from tailnet device | `TAILSCALE_HOSTNAME` unset/wrong, or service not restarted -- `nssm get CaseCalendar AppEnvironmentExtra`; correct; `nssm restart CaseCalendar` |
| Phone can't reach right after host reboot, works 30s later | tailscaled reconnecting WireGuard (5-30s); loopback up immediately -- wait 30s |
| `/api/identity` returns `{"user":"local"}` from tailnet device | Hitting direct loopback OR device is tagged (no `Tailscale-User-Login`) -- use the tailnet hostname from a user-account device |

**Stopping Tailscale later:** `nssm set CaseCalendar AppEnvironmentExtra "TZ=America/Los_Angeles" "NODE_ENV=production"; nssm restart CaseCalendar; tailscale serve off`.

*Hono bind stays `127.0.0.1:3747`. Tailscale Serve is the only inbound network surface for tailnet traffic.*

---

## Desktop Wallpaper (Phase 9)

Wallpaper auto-regenerates from the deadline view every 30 minutes and within ~10s of any deadline change. 7680x2160 screenshots via Playwright headless Chromium, applied via the IDesktopWallpaper COM interface.

### Overview

In-process in the NSSM service:

- **Off by default.** The worker only runs when `WALLPAPER_ENABLED=true` in `.env.local`. With the default `.env.example` value of `false`, nothing below executes. See [Enabling](#desktop-wallpaper-phase-9----enabling).
- `node-cron` every 30 minutes (`*/30 * * * *`); any deadline change triggers a trailing-edge 10s debounce.
- Screenshots in `data/wallpaper-*.png` (gitignored per OPS-05; last 10 retained). Applied via `scripts/wallpaper-set.ps1` using `IDesktopWallpaper::SetWallpaper($null, $path)` (`$null` = all monitors).
- Worker fetches `http://127.0.0.1:3747/wallpaper?t=<unix-ms>` over loopback (SAFE-07 preserved).

### Install Playwright Chromium

`setup.ps1` Step 6 installs Chromium when `WALLPAPER_ENABLED=true`; disabled (default) prints `Wallpaper disabled (set WALLPAPER_ENABLED=true in .env.local to enable)` and skips. Manual: `npx playwright install chromium` (add `--with-deps` if launch fails). Cache: `%USERPROFILE%\AppData\Local\ms-playwright` (~120 MB).

---

### NSSM Session 0 Fix (only when WALLPAPER_ENABLED=true)

Only relevant when `WALLPAPER_ENABLED=true`. With wallpaper disabled (default), NSSM as LocalSystem is recommended -- no password, no Session 1 requirement.

**Why Session 0 blocks wallpaper apply:** Windows Vista+ isolates services in Session 0 (no visible desktop); the interactive user runs in Session 1. `IDesktopWallpaper` changes wallpaper for the caller's session; from Session 0 it returns HRESULT error or changes an invisible wallpaper. (The "Allow service to interact with desktop" checkbox was removed in Windows 10 1803+.)

```powershell
# Default (LocalSystem, no stored password):
pwsh -ExecutionPolicy Bypass -File .\scripts\nssm-install.ps1
# Under your user (only needed for wallpaper apply):
pwsh -ExecutionPolicy Bypass -File .\scripts\nssm-install.ps1 -LogonUser '.\<your-username>'
```

`-LogonUser` prompts for your Windows password (NSSM stores it encrypted via DPAPI); **requires a real local Windows password** -- PIN/Microsoft Account sign-ins do not have one (use [Task Scheduler Alternative](#task-scheduler-alternative-no-stored-password)).

Verify: `Get-WmiObject Win32_Service -Filter "Name='CaseCalendar'" | Select-Object StartName`.

| Symptom | Cause / Fix |
|---------|-------------|
| SERVICE_RUNNING, `Win+D` shows old wallpaper, PNGs piling up in `data/` | Wallpaper enabled, service as LocalSystem in Session 0 -- set `WALLPAPER_ENABLED=false`, OR `-LogonUser`, OR Task Scheduler |
| `wallpaper-set.ps1` HRESULT 0x80070005 (E_ACCESSDENIED) | Session 0 access denied -- same options |
| Log: `wallpaper disabled (set WALLPAPER_ENABLED=true in .env.local)` | Worker gated off (default) -- see [Enabling](#desktop-wallpaper-phase-9----enabling) |

---

### Task Scheduler Alternative (no stored password)

**When to use:** PIN/Microsoft Account sign-in (no local password for NSSM), OR you do not want a service holding a credential. Also the easiest way to enable Phase 9 wallpaper -- the server runs in your interactive session (Session 1), so there is no Session 0 problem. **Trade-off:** only runs while signed in (NSSM starts at boot before login); for a single-user lawyer's machine, usually fine.

A scheduled task starts the **tray app** (`scripts\tray.ps1`) hidden at logon. The tray runs the server with no console window and adds a calendar icon to the notification area:

| Tray menu item | What it does |
|----------------|--------------|
| Open Case Calendar (or double-click the icon) | Opens `http://127.0.0.1:3747` |
| Refresh wallpaper now | Runs `npm run wallpaper:once` |
| Restart server | Stops the whole server process tree, then starts it again |
| Check for updates / Install update | `git fetch`; installs via `scripts\update.ps1` (see below) |
| Open logs folder | `logs\` -- `case-calendar.log` (server), `tray.log`, `update.log` |
| Quit (stops the server) | Stops the server and removes the icon until next logon |

The tray restarts the server if it crashes (and notifies you); after 3 crashes in 10 minutes it stops retrying and shows an error. It checks for updates at startup and every 6 hours and notifies you when one is available. The server log rotates at 10 MB.

**Install (ordinary PowerShell, no Administrator required; run after `npm run build`):**

```powershell
cd C:\apps\case-calendar
powershell -ExecutionPolicy Bypass -File .\scripts\install-tray.ps1
```

This replaces any existing `CaseCalendar` task (including the older `cmd /c npm run start` one), stops a server already on port 3747, registers the task with no run-time limit (the Task Scheduler default of 72 hours would stop the server after 3 days), and starts the tray. On Windows 11 the icon may be under the `^` overflow arrow; drag it onto the taskbar to keep it visible. **Verify auto-start:** sign out, sign back in, wait ~10s, open `http://127.0.0.1:3747`.

**Remove:** `powershell -ExecutionPolicy Bypass -File .\scripts\install-tray.ps1 -Uninstall` (data in `data\` is untouched).

**Updating:** use the tray's **Install update**. It stops the server, then `scripts\update.ps1` runs `git pull --ff-only`, `npm ci` (only if `package.json`/`package-lock.json` changed), backs up `data\deadlines.db` and runs `npm run db:push` (only if `drizzle/` changed), and `npm run build`; then the tray restarts the server, which re-renders the wallpaper on startup. If any step fails, `update.ps1` resets to the previous commit and rebuilds it; `logs\update.log` has the details. It refuses to run if tracked files have local edits -- except a lone `package-lock.json` rewrite by a different npm version, which it restores.

**Do not rebuild while the server is running.** `npm run build` replaces the hashed asset files, but a running server keeps serving the old `index.html` that points at them, so pages (and the wallpaper) render blank until the server restarts. Also note that `Stop-ScheduledTask` only ends the task's top-level process and can leave `node` running on port 3747; use the tray's **Restart server** (or re-run `install-tray.ps1`) instead.

**Bonus -- Phase 9 wallpaper for free:** with `WALLPAPER_ENABLED=true`, the wallpaper worker runs in your session, so `IDesktopWallpaper::SetWallpaper` reaches the real desktop -- no NSSM `-LogonUser` needed.

**If NSSM was previously installed:** `nssm stop CaseCalendar; nssm remove CaseCalendar confirm` first (Administrator) to avoid two copies fighting over port 3747. `install-tray.ps1` refuses to run while that service exists.

---

### Desktop Wallpaper (Phase 9) -- Enabling

The worker is **off by default**. Boot gate in `src/server/index.ts` around line 109:

```ts
if (process.env.WALLPAPER_ENABLED === 'true') {
  startWallpaperWorker()
} else {
  logger.info('wallpaper disabled (set WALLPAPER_ENABLED=true in .env.local)')
}
```

`.env.example` ships `WALLPAPER_ENABLED=false` -- no Playwright, no PNGs, no PowerShell, no Session 0 problem.

**To enable:** (1) set `WALLPAPER_ENABLED=true` in `.env.local`; (2) re-run `.\scripts\setup.ps1` (Step 6 downloads Chromium, ~120 MB) or `npx playwright install chromium`; (3) choose a Session 1+ deployment -- **(a)** reinstall NSSM with `-LogonUser '.\<your-username>'` (needs a real local Windows password -- see [NSSM Session 0 Fix](#nssm-session-0-fix-only-when-wallpaper_enabledtrue)), OR **(b)** switch to the [Task Scheduler Alternative](#task-scheduler-alternative-no-stored-password); (4) restart -- NSSM: `nssm restart CaseCalendar`; Task Scheduler: tray menu > Restart server; (5) tail the log (should NOT show `wallpaper disabled`); confirm pipeline with `npm run wallpaper:once`.

**To disable later:** set `WALLPAPER_ENABLED=false`, restart. PNGs in `data/` stay (gitignored). `npx playwright uninstall chromium` reclaims ~120 MB.

**Symptom -- enabled but log shows `wallpaper disabled`:** stale NSSM env -- restart; `nssm get CaseCalendar AppEnvironmentExtra`. **Symptom -- PNGs in `data/` but desktop unchanged:** server in Session 0 (LocalSystem). Use option (a) or (b).

---

### DPI Scaling

For the sharpest wallpaper text on the 57" Odyssey Neo G9 (7680x2160 native), set Windows display scaling to **100%**.

- At **100% scaling**: 1 logical pixel = 1 physical pixel. Playwright's `deviceScaleFactor: 1` matches Windows exactly. Text renders at full native resolution with no resampling.
- At **125% scaling**: Windows considers the logical desktop to be 6144x1728 (7680/1.25). It downsamples the 7680x2160 PNG to fill the logical desktop -- no distortion, no black bars, edge-to-edge display. However, text appears approximately 20% smaller relative to screen height.

This is a cosmetic preference, not a correctness issue. The PNG will display edge-to-edge at either setting. If you prefer larger text at 125% scaling, increase the CSS font sizes in `src/client/routes/wallpaper.tsx` by ~25%.

---

### File Retention

- PNGs are written to `data/wallpaper-{ISO-timestamp}.png` where timestamp is `YYYY-MM-DDTHH-mm-ssZ` (Windows-safe: colons replaced with hyphens for NTFS compatibility).
- The last **10** files are retained; older PNGs are pruned after each screenshot run.
- The `data/` directory is gitignored (per OPS-05) -- PNGs never enter version control.
- Approximate size: 3-8 MB per PNG -> maximum ~80 MB on disk.

---

### Manual Debug: wallpaper:once

Use this to verify the full pipeline (screenshot + prune + apply) without waiting for the cron schedule:

```powershell
npm run wallpaper:once
```

**Requirement:** The Hono server must be running (via NSSM or `npm run dev:server`) on `127.0.0.1:3747` -- the worker fetches the `/wallpaper` route over loopback.

**What it does:** Launches Playwright, takes one screenshot at 7680x2160, prunes old files (keeps newest 10), applies the PNG on Windows via `wallpaper-set.ps1`, then exits.

---

### Resource Usage

| Resource | Expected Usage |
|----------|---------------|
| Playwright Chromium | ~50 MB resident in the node process tree (persistent browser) |
| PowerShell (wallpaper apply) | Short-lived (<1 second per apply), ~30 MB peak |
| Disk | Up to ~80 MB for 10 retained PNGs (3-8 MB each) |
| CPU (cron schedule only) | Negligible -- fires every 30 minutes |

---

### Troubleshooting

| Symptom | Cause / Fix |
|---------|-------------|
| PNGs in `data/` but `Win+D` shows old wallpaper | LocalSystem (Session 0) -- `IDesktopWallpaper` silently no-ops. Re-run with `-LogonUser` or use Task Scheduler. Quick fix: `nssm set CaseCalendar ObjectName .\<username>; nssm restart CaseCalendar` |
| `wallpaper: browser launch failed at startup` | Chromium binary not installed -- `npx playwright install --with-deps chromium` |
| `wallpaper: screenshot failed` with `TimeoutError: navigation` | Hono not listening on 3747 when worker tried to fetch (race during restart). Self-corrects on next cron tick or deadline mutation. If persistent: `nssm status CaseCalendar; netstat -ano | findstr 3747` |

---

## Email Digest (Phase 10)

Daily 7:00 AM LA-time digest: next 14 days + overdue (capped at 30 most recent), plain-text + HTML multipart. Reads SMTP creds from `.env.local`; only runs when `EMAIL_DIGEST_ENABLED=true` (else no-ops silently, preserving SAFE-09). `npm run email:once` for one-shot testing.

### Configure SMTP

Copy `.env.example` -> `.env.local`, fill in the seven vars, `nssm restart CaseCalendar`.

| Var | Description |
|-----|-------------|
| `SMTP_HOST` | e.g. `smtp.gmail.com` |
| `SMTP_PORT` | `587` STARTTLS (recommended) or `465` SMTPS |
| `SMTP_USER` | usually your email |
| `SMTP_PASS` | Gmail: App Password (16 chars) |
| `SMTP_FROM` | e.g. `Case Calendar <you@gmail.com>` |
| `SMTP_TO` | recipient |
| `EMAIL_DIGEST_ENABLED` | `true` to enable daily 7am cron |

TLS auto-selected: 587 -> STARTTLS (`secure: false` + `requireTLS: true`); 465 -> SMTPS (`secure: true`).

**Gmail App Password** ("Less Secure Apps" removed Sept 2024): enable 2-Step Verification at https://accounts.google.com/security; same page -> **App passwords** -> **Mail** + **Other (Custom name)** -> `Case Calendar` -> **Generate**; paste into `SMTP_PASS` (spaces optional). Other providers (SendGrid, Postmark, Mailgun, AWS SES, self-hosted Postfix) work the same way.

**File permissions:** `.env.local` readable only by your user (right-click -> **Properties** -> **Security** -> **Edit** -> remove `Users`, keep your user with **Read**). NSSM must run as that same user (`-LogonUser '.\<your-username>'`), or grant `LocalSystem` read access (less secure).

### Manual Debug: email:once

`npm run email:once` -- requires `.env.local` with all seven vars + `EMAIL_DIGEST_ENABLED=true`; SMTP reachable (`Test-NetConnection smtp.gmail.com -Port 587`). Sends one email, exits `0`/`1`. Does NOT schedule the cron.

### Troubleshooting

| Symptom | Cause / Fix |
|---------|-------------|
| `email digest disabled (set EMAIL_DIGEST_ENABLED=true)` | Var unset -- set it |
| `email digest disabled (missing env vars: ...)` | Var missing -- check `.env.example` |
| `email: SMTP verify failed` `EAUTH`/`ENOAUTH` | Wrong credentials -- regenerate App Password |
| `email: SMTP verify failed` `ECONNREFUSED` | Wrong host/port or firewall -- `Test-NetConnection $SMTP_HOST -Port $SMTP_PORT` |
| `email: SMTP verify failed` `ESOCKET`/`ETIMEDOUT` | Slow server -- retry; contact provider |
| `email:once` exits 1 `ENOENT .env.local` | `cd C:\apps\case-calendar` |
| Email never arrives, no errors | Wrong `SMTP_TO` or spam-filtered |
| Two emails at 7am | Duplicate service -- `nssm status CaseCalendar` |

After any `.env.local` change: `nssm restart CaseCalendar`. **Resource usage:** ~5 MB Nodemailer; one SMTP connection/day.

---

## NL Quick-Add (Phase 11)

Cmd+K (Ctrl+K on Windows), type "Smith deposition June 15", Enter -- the new-deadline form opens prefilled. Anthropic Claude. **Optional** -- Cmd+K opens without the key, Enter shows "NL parser disabled."

- **Provider:** Anthropic Claude (`claude-sonnet-4-6`) via `@anthropic-ai/sdk`. **Endpoint:** `POST /api/deadlines/parse` (server-side proxy; API key stays on host).
- **Cost:** ~$0.0000035/parse (~$0.35/100K).
- **Privacy:** only the user-typed text is sent. Stored deadlines, case labels, and types table are NOT transmitted. NL parsing is the one deliberate exception to the local-only policy (see `.planning/PROJECT.md`).
- **Safety (NL-03):** parsed values pre-fill the form; user MUST click Save -- LLM result never auto-saved (malpractice risk: date hallucinations).

### Configure ANTHROPIC_API_KEY

1. https://console.anthropic.com -> Settings -> API Keys -> Create Key. Copy `sk-ant-...`.
2. Add `ANTHROPIC_API_KEY=sk-ant-...` to `.env.local`. `nssm restart CaseCalendar`.
3. Verify: Cmd+K, type, Enter -- form opens prefilled in ~2s.

Leave unset to skip; Cmd+K still opens, Enter shows "NL parser disabled".

### Manual Debug: parse:once

```powershell
npm run parse:once -- "Smith deposition June 15"
```

Prints parsed JSON. Useful for tuning `src/server/lib/nl-parser.ts`. **Cost tracking:** route logs `inputTokens`/`outputTokens` via pino (https://console.anthropic.com/usage). **Privacy:** prompt includes deadline type names so the LLM can map text to a typeId. If you renamed types with client-identifying info, those names will be transmitted -- adjust accordingly.

### Troubleshooting

- **"NL parser disabled" on Enter** -- key unset/empty. Add, restart.
- **"Parser timed out"** -- Anthropic API >10s; transient. SDK uses `maxRetries: 0`.
- **"Couldn't parse -- try rewording"** -- malformed LLM result. Include case name, type, date.
- **High costs** -- audit logs for unexpected `nl-parse: route success`. Route caps text at 500 chars.

**Resource usage:** ~3 MB Anthropic SDK (after first parse); one outbound HTTPS per Cmd+K Enter; no background jobs.

---

## Import and Email Import

### AI provider

Quick-add, Import and Email Import use one AI provider, chosen in `.env.local`:

- **OpenAI** when `OPENAI_API_KEY` is set. Model: `OPENAI_MODEL` (default `gpt-5.6`). Requests use the Responses API with structured outputs and `store: false`.
- **Anthropic** otherwise, with `ANTHROPIC_API_KEY` (quick-add `claude-sonnet-4-6`, Import `claude-opus-5-5`).
- `LLM_PROVIDER=openai` or `LLM_PROVIDER=anthropic` forces one.

API keys are billed separately from ChatGPT or Claude subscriptions: create them at platform.openai.com or console.anthropic.com and fund API credit there. Import and Email Import log each call's token counts (`extract: OpenAI success` / `extract: model success`) in `logs\case-calendar.log`.

### Import (paste an order)

Click **Import** in the app header, paste a scheduling order, minute order, stipulation or email, optionally pick the case, and click **Find deadlines**. The AI provider proposes every deadline it finds, each with a title, details, type, case and the sentence it came from. Dates the text states outright are marked stated; dates the model had to derive (e.g. "60 days before trial") are marked **computed: verify** with the computation shown. Edit or uncheck anything, then **Add N deadlines** saves them all in one transaction. Nothing is saved before that. The pasted text is sent to the AI provider; it is not logged.

### Email Import

Email orders to a plus-address (e.g. `you+calendar@gmail.com`; Gmail delivers it to your normal inbox) and review them in the app's **Inbox**.

1. In `.env.local`:
   ```
   EMAIL_IMPORT_ENABLED=true
   EMAIL_IMPORT_ADDRESS=you+calendar@gmail.com
   EMAIL_IMPORT_ALLOWED_SENDERS=you@gmail.com,you@yourfirm.com
   ```
   IMAP uses `imap.gmail.com:993` with the `SMTP_USER` / `SMTP_PASS` Gmail app password from the Email Digest setup (override with `IMAP_HOST`, `IMAP_PORT`, `IMAP_USER`, `IMAP_PASS`). An AI provider key (`OPENAI_API_KEY` or `ANTHROPIC_API_KEY`) must be set.
2. Restart (tray menu > **Restart server**). The log shows `email import worker started`.
3. Send or forward an order to the address. Within 5 minutes the app header shows **Inbox (1 to review)** and the wallpaper shows **1 emailed order to review**. Open it, review, **Add**. **Check now** in the Inbox checks immediately.

How it behaves:

- **Read-only mailbox access.** Messages are never marked read, moved or deleted. The last 14 days of mail to the address is checked; each Message-ID is processed once.
- **Sender check.** A message is processed only if the sender is on `EMAIL_IMPORT_ALLOWED_SENDERS` **and** Gmail recorded a passing DMARC, or an aligned DKIM/SPF, check for it (results stamped by any server other than `mx.google.com` are ignored). Anything else is listed under **Not imported** with the reason and is never sent to the AI provider.
- **No auto-save.** Extracted deadlines wait in the Inbox until you add them. Adding saves the deadlines and marks the email done in one transaction.
- Without an AI provider key, verified emails wait unprocessed and the Inbox says so.
- Attachments are not read yet: paste the order's text into the email body (or use Import).

## SAFE Checklist Summary

Each SAFE has an automated proof. Run `cross-env TZ=America/Los_Angeles npm test`.

| ID | Description | Proof |
|----|-------------|-------|
| SAFE-01 | Date round-trip across US timezones | src/server/tz.test.ts |
| SAFE-02 | DST boundary correctness | src/server/tz.test.ts |
| SAFE-03 | No raw `new Date(string)` outside date util | tests/date-guard.test.ts |
| SAFE-04 | SQLite PRAGMA on startup (WAL + foreign_keys) | src/server/db.test.ts |
| SAFE-05 | VACUUM INTO backup + 30-day retention | src/server/backup.test.ts |
| SAFE-06 | Persistent error banner on 500 | src/client/App.crud.test.tsx |
| SAFE-07 | Hono binds 127.0.0.1 only | tests/safe-07-bind-loopback.test.ts |
| SAFE-08 | CORS explicit allowlist | src/server/cors.test.ts |
| SAFE-09 | No external network in src/client | tests/safe-09-no-external-network.test.ts |
| SAFE-10 | req.user middleware placeholder | src/server/user-middleware.test.ts |

Full Windows smoke acceptance: Task 6 of `.planning/phases/06-safety-hardening-windows-service/06-04-PLAN.md`.
