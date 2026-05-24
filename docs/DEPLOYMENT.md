# Self-host on Windows

Cold-start runbook for deploying Case Calendar as a Windows service that survives reboot. Covers prerequisites, NSSM install, verification, update procedure, troubleshooting, and uninstall.

---

## Prerequisites

Before running `scripts\nssm-install.ps1`, confirm these are in place:

- **Node.js 22 LTS** — verify with `node --version` (expected `v22.x.x`). Download from nodejs.org.
- **NSSM 2.24+** — verify with `nssm version`. Download from nssm.cc/download. Place `nssm.exe` somewhere on your `PATH` (e.g. `C:\Windows\System32`).
- **Admin PowerShell** — right-click PowerShell → "Run as Administrator". Without admin rights the service install will fail. Fallback: run `npm run start` in a normal terminal (no service, no auto-restart on reboot).
- **Windows system timezone = `Pacific Standard Time`** — verify with `[System.TimeZoneInfo]::Local.Id` in PowerShell. If different, the install script warns and prompts for confirmation before continuing. All `today` date calculations and backup retention use this timezone.

---

## Install

```powershell
# 1. Clone the repo
git clone <repo> C:\apps\case-calendar

# 2. Enter the project directory
cd C:\apps\case-calendar

# 3. Install Node dependencies
npm install

# 4. Build production artifacts (Vite + tsc)
npm run build

# 5. Install the NSSM service (run as Administrator)
pwsh -ExecutionPolicy Bypass -File .\scripts\nssm-install.ps1

# 6. Start the service
nssm start CaseCalendar
```

The install script is idempotent — re-running it stops and removes the prior service before installing fresh. All NSSM settings are re-applied from the script on each run.

---

## Verify

Copy-pasteable PowerShell verification checklist — run each command after `nssm start CaseCalendar`:

```powershell
# Service is running
nssm status CaseCalendar
# Expected output: SERVICE_RUNNING

# Bound to loopback only (SAFE-07)
netstat -ano | findstr 3747
# Expected: exactly one line containing 127.0.0.1:3747 (NOT 0.0.0.0:3747)

# HTTP 200 from SPA root
Invoke-WebRequest http://127.0.0.1:3747 -UseBasicParsing | Select-Object -ExpandProperty StatusCode
# Expected: 200

# JSON array from API
Invoke-WebRequest http://127.0.0.1:3747/api/deadlines -UseBasicParsing | Select-Object -ExpandProperty Content
# Expected: JSON array ([] if no deadlines yet)

# Log file contains startup line
Get-Content C:\apps\case-calendar\logs\case-calendar.log -Tail 20
# Expected: pino JSON lines including "Server listening on http://127.0.0.1:3747"
```

Open `http://127.0.0.1:3747` in a browser. The SPA loads and the deadlines view renders.

---

## Post-Install Reboot Verification (OPS-04)

Restart Windows normally. After login, open `http://127.0.0.1:3747` in a browser **without launching anything manually** (no terminal, no npm). If the page loads, OPS-04 passes — the NSSM service started automatically at boot via `Start=SERVICE_AUTO_START`.

---

## Update Procedure

```powershell
# Stop the service
nssm stop CaseCalendar

# Pull latest changes
cd C:\apps\case-calendar
git pull

# Install any new dependencies
npm install

# Rebuild
npm run build

# Restart the service
nssm start CaseCalendar
```

Verify the update with the same checklist in the Verify section above.

---

## Troubleshoot

### Service won't start / restart loop

The most common cause is `dist\server\src\server\index.js` missing or corrupted. Tail the error log first:

```powershell
Get-Content C:\apps\case-calendar\logs\case-calendar.err -Tail 30
```

If the error is `Cannot find module`, run `npm run build` then `nssm restart CaseCalendar`. NSSM enters a restart loop when Node exits with a non-zero code — the 10MB log rotation (`AppRotateBytes`) prevents disk exhaustion while you investigate.

### Bound to wrong port / address

If `netstat -ano | findstr 3747` shows `0.0.0.0:3747` instead of `127.0.0.1:3747`, SAFE-07 has regressed. Investigate `src/server/index.ts` — the `hostname` parameter passed to `serve()` must be `'127.0.0.1'`. Run `cross-env TZ=America/Los_Angeles npm test -- tests/safe-07-bind-loopback.test.ts` to reproduce.

### Logs not appearing

Confirm the `logs\` directory exists under the install path and that the service account (LocalSystem by default) has write permission. Install the app under `C:\apps\` rather than `C:\Program Files\` — Program Files has UAC-restricted write access for LocalSystem.

---

## Uninstall

```powershell
# Stop and remove the service
nssm stop CaseCalendar
nssm remove CaseCalendar confirm

# Optional: remove the install directory
Remove-Item -Recurse -Force C:\apps\case-calendar
```

The SQLite database lives in the `data\` subdirectory. Move `data\deadlines.db` somewhere safe before removing the install directory if you want to keep your deadline history.

---

## Remote Access via Tailscale

Tailscale Serve proxies tailnet traffic to the loopback-bound Hono server, making Case Calendar reachable from your phone or travel laptop over your private tailnet — no public internet exposure, no app source changes required. *Hono continues to bind `127.0.0.1:3747` only. Tailscale Serve is a same-host proxy; SAFE-07 is preserved.*

### Prerequisites

- Tailscale installed on the host Windows machine (the machine running the NSSM service). Download from [tailscale.com](https://tailscale.com/download).
- Tailscale installed on the client device (phone, travel laptop). Both devices must be signed in to the same tailnet.
- The Case Calendar NSSM service installed and running. Complete the **Install** and **Verify** sections above before proceeding.

### Enable Tailscale Serve

The serve configuration persists across reboots — run this command once. After a Windows reboot, tailscaled resumes the serve config automatically (per [tailscale.com/kb/1312/serve](https://tailscale.com/kb/1312/serve)).

Open an **Administrator** PowerShell terminal (no `sudo` needed on Windows):

```powershell
tailscale serve --bg http://127.0.0.1:3747
```

Verify the proxy is active:

```powershell
tailscale serve status
# Expected: a single proxy entry mapping your tailnet hostname to http://127.0.0.1:3747
```

The output of `tailscale serve status` shows your tailnet hostname (e.g. `lawyer-laptop.tail-scale.ts.net`). Copy this hostname — you will need it in the next step. **Do not include the scheme or port.**

### Configure CORS for the Tailscale Origin

When a browser on your phone or travel laptop visits Case Calendar via the tailnet hostname, it sends an `Origin` header containing that hostname (e.g. `http://lawyer-laptop.tail-scale.ts.net`). The server's CORS allowlist must include this origin or browsers will reject all API responses.

Set the `TAILSCALE_HOSTNAME` environment variable via NSSM. Replace `lawyer-laptop.tail-scale.ts.net` with the actual tailnet hostname from `tailscale serve status`:

```powershell
nssm set CaseCalendar AppEnvironmentExtra "TZ=America/Los_Angeles" "NODE_ENV=production" "TAILSCALE_HOSTNAME=lawyer-laptop.tail-scale.ts.net"
nssm restart CaseCalendar
```

> **Warning — hostname format:** Set `TAILSCALE_HOSTNAME` to the hostname **only** — no `http://` prefix, no port suffix, no trailing slash. Correct example: `lawyer-laptop.tail-scale.ts.net`. The server appends `http://` and `https://` automatically. Including the scheme produces a malformed origin like `http://http://...` that never matches any browser request and causes CORS errors.

> **Warning — service restart required:** After **any** change to `TAILSCALE_HOSTNAME` via `nssm set`, you **must** restart the service (`nssm restart CaseCalendar`). NSSM env vars are read once at service start — the in-memory CORS allowlist will be stale until the service restarts. Symptom if you forget: CORS errors in the browser console from the tailnet device.

### Verify Remote Access

Run each step from the **client device** (phone or travel laptop), not the host machine:

1. Open `http://<your-tailnet-hostname>` in a browser. The Case Calendar SPA should load and the deadlines list should render.

2. Open `http://<your-tailnet-hostname>/api/identity`. The response should be `{"user":"<your-tailnet-email>"}`. This confirms the `Tailscale-User-Login` header is being injected by Tailscale Serve and read by the server.

   **Note:** If you open `http://127.0.0.1:3747/api/identity` from the **host** machine (direct loopback, bypassing Tailscale Serve), the response will be `{"user":"local"}` — this is correct and expected behavior. The `Tailscale-User-Login` header is only present on the Tailscale Serve proxy path.

3. On the host, confirm the CORS allowlist extension is active in the service log:

   ```powershell
   Get-Content C:\apps\case-calendar\logs\case-calendar.log -Tail 20 | Select-String "tailscale"
   # Expected: a pino JSON line with message "cors: tailscale origins allowed (http + https)"
   ```

### Optional: HTTPS via Tailscale Auto-Cert

HTTP over the tailnet is encrypted end-to-end by WireGuard and is safe for this use case. Browsers may show a "Not Secure" indicator — this is cosmetic on a private tailnet (see [tailscale.com/kb/1153/enabling-https](https://tailscale.com/kb/1153/enabling-https)).

For HTTPS in the browser address bar (auto-provisioned Let's Encrypt cert — no manual cert management):

```powershell
tailscale serve off
tailscale serve --bg --https=443 http://127.0.0.1:3747
```

Requires the HTTPS feature enabled on your tailnet (configure at the Tailscale admin panel). Tailscale auto-renews the certificate tied to your tailnet hostname.

### Troubleshooting

#### CORS errors from the tailnet device

**Symptom:** Browser on the phone or travel laptop shows CORS errors; API requests fail while the SPA loads.

**Cause:** `TAILSCALE_HOSTNAME` is not set, is set to a wrong value (e.g. includes `http://` prefix or a port number), or the service was not restarted after the env var change.

**Fix:**

```powershell
# Confirm the current value
nssm get CaseCalendar AppEnvironmentExtra
# Expected: three entries including TAILSCALE_HOSTNAME=<hostname-only>

# If correct format but service wasn't restarted:
nssm restart CaseCalendar
```

Check the format: hostname only, no `http://`, no port, no slash. If the format was wrong, correct the `TAILSCALE_HOSTNAME` value and restart.

#### Not reachable immediately after Windows reboot

**Symptom:** Phone can't reach the app right after the host reboots, but can reach it 30 seconds later.

**Cause:** tailscaled must reconnect the WireGuard tunnel and validate the node key before Tailscale Serve becomes active. This takes 5–30 seconds after boot depending on network speed. The NSSM service starts independently and is available on direct loopback (`127.0.0.1:3747`) immediately.

**Fix:** Wait 30 seconds and retry from the phone.

#### `/api/identity` returns `{"user":"local"}` from the tailnet device

**Symptom:** Visiting `/api/identity` from the phone returns `{"user":"local"}` instead of your email.

**Cause:** Either the request is going through direct loopback (e.g. you opened `http://127.0.0.1:3747` from the host browser instead of the tailnet hostname URL), or your device is tagged (non-person device) in your tailnet. Tagged devices do not receive `Tailscale-User-Login` header injection.

**Fix:** Use the tailnet hostname URL from a user-account device, not the direct loopback address. If the device is tagged, this is expected behavior.

#### Stopping using Tailscale later

When removing Tailscale, also remove `TAILSCALE_HOSTNAME` from `AppEnvironmentExtra` and restart the service:

```powershell
nssm set CaseCalendar AppEnvironmentExtra "TZ=America/Los_Angeles" "NODE_ENV=production"
nssm restart CaseCalendar
tailscale serve off
```

The stale `TAILSCALE_HOSTNAME` entry has near-zero practical risk (the CORS allowlist simply includes an unreachable origin), but cleanliness matters.

To check or disable Tailscale Serve at any time: `tailscale serve status` to confirm the proxy is active; `tailscale serve off` to disable.

*Throughout this entire setup, the Hono server bind remains `127.0.0.1:3747`. Tailscale Serve is the only inbound network surface for tailnet traffic, and it forwards to the same loopback address.*

---

## Desktop Wallpaper (Phase 9)

Your Windows desktop wallpaper auto-regenerates from the deadline view every 30 minutes and within about 10 seconds of any deadline change. Screenshots are taken at 7680×2160 via Playwright headless Chromium and applied via the IDesktopWallpaper COM interface.

### Overview

The wallpaper pipeline is fully in-process inside the NSSM service:

- A `node-cron` job fires every 30 minutes (`*/30 * * * *`) to take a fresh screenshot.
- Any deadline create/update/delete/type-change triggers a trailing-edge 10-second debounce that takes a screenshot within ~10s of the last change.
- Screenshots are written to `data/wallpaper-*.png` (gitignored per OPS-05; last 10 retained).
- On Windows, the latest PNG is applied via `scripts/wallpaper-set.ps1` using `IDesktopWallpaper::SetWallpaper($null, $path)` — `$null` monitor ID means all monitors.
- The worker fetches `http://127.0.0.1:3747/wallpaper?t=<unix-ms>` over loopback only (SAFE-07 preserved).

---

### Install Playwright Chromium

This step is **not** run automatically by `npm install`. Run it once after cloning and after every `npx playwright install` command:

```powershell
npx playwright install chromium
```

If Playwright Chromium fails to launch (e.g. missing OS dependencies on a fresh Windows install), run:

```powershell
npx playwright install --with-deps chromium
```

---

### NSSM Session 0 Fix

**This is required for wallpaper apply to work.** Without it, the service runs as LocalSystem in Windows Session 0, and `IDesktopWallpaper::SetWallpaper` silently fails.

**Why Session 0 blocks wallpaper apply:** Windows Vista+ isolates services in Session 0, a non-interactive session with no visible desktop. The interactive user runs in Session 1. `IDesktopWallpaper` changes the wallpaper for the calling process's session — when called from Session 0, it either returns an HRESULT error or changes a wallpaper the user never sees. The "Allow service to interact with desktop" checkbox was removed in Windows 10 1803+.

**Recommended install command (run as Administrator):**

```powershell
pwsh -ExecutionPolicy Bypass -File .\scripts\nssm-install.ps1 -LogonUser '.\<your-username>'
```

The script will prompt for your Windows password. The password is stored encrypted by NSSM via Windows DPAPI (not in plaintext).

**Verify the service account was set:**

```powershell
Get-WmiObject Win32_Service -Filter "Name='CaseCalendar'" | Select-Object StartName
```

Expected output: `.\<your-username>` (NOT `LocalSystem`).

**Symptom table:**

| Symptom | Root Cause | Fix |
|---------|------------|-----|
| Wallpaper never changes despite cron ticks in logs | Service running as LocalSystem in Session 0 | Re-run `nssm-install.ps1 -LogonUser '.\<username>'` |
| PS1 exits with HRESULT 0x80070005 (E_ACCESSDENIED) | Session 0 IDesktopWallpaper access denied | Same fix as above |

See the Task Scheduler alternative below if you prefer not to store your password in the NSSM service config.

---

### Task Scheduler Alternative (no stored password)

If you do not want NSSM to hold your Windows password, keep NSSM running as LocalSystem. The worker still generates the PNG in `data/`. Use a Windows Task Scheduler entry to apply it under your user account at logon.

**Trade-off:** The Task Scheduler path adds a second process; the NSSM ObjectName path is simpler and recommended. The Task Scheduler path requires a small wrapper script you write yourself (see below).

**How it works:**

1. Keep NSSM as LocalSystem (no `-LogonUser` needed — the worker generates PNGs but apply is skipped).
2. Create a Task Scheduler entry:
   - **Trigger:** At log on of `<your user>`
   - **Action:** `pwsh -NoProfile -WindowStyle Hidden -File C:\apps\case-calendar\scripts\wallpaper-watch.ps1`
3. The wrapper script (`wallpaper-watch.ps1`) polls `data\wallpaper-*.png` for the newest file every 30 seconds and calls `scripts\wallpaper-set.ps1 -Path <newest>`.

> **Note:** `wallpaper-watch.ps1` is a DIY script not shipped in this repo. The NSSM ObjectName path (`-LogonUser`) is the supported, recommended deployment for wallpaper apply.

---

### DPI Scaling

For the sharpest wallpaper text on the 57" Odyssey Neo G9 (7680×2160 native), set Windows display scaling to **100%**.

- At **100% scaling**: 1 logical pixel = 1 physical pixel. Playwright's `deviceScaleFactor: 1` matches Windows exactly. Text renders at full native resolution with no resampling.
- At **125% scaling**: Windows considers the logical desktop to be 6144×1728 (7680÷1.25). It downsamples the 7680×2160 PNG to fill the logical desktop — no distortion, no black bars, edge-to-edge display. However, text appears approximately 20% smaller relative to screen height.

This is a cosmetic preference, not a correctness issue. The PNG will display edge-to-edge at either setting. If you prefer larger text at 125% scaling, increase the CSS font sizes in `src/client/routes/wallpaper.tsx` by ~25%.

---

### File Retention

- PNGs are written to `data/wallpaper-{ISO-timestamp}.png` where timestamp is `YYYY-MM-DDTHH-mm-ssZ` (Windows-safe: colons replaced with hyphens for NTFS compatibility).
- The last **10** files are retained; older PNGs are pruned after each screenshot run.
- The `data/` directory is gitignored (per OPS-05) — PNGs never enter version control.
- Approximate size: 3–8 MB per PNG → maximum ~80 MB on disk.

---

### Manual Debug: wallpaper:once

Use this to verify the full pipeline (screenshot + prune + apply) without waiting for the cron schedule:

```powershell
npm run wallpaper:once
```

**Requirement:** The Hono server must be running (via NSSM or `npm run dev:server`) on `127.0.0.1:3747` — the worker fetches the `/wallpaper` route over loopback.

**What it does:** Launches Playwright, takes one screenshot at 7680×2160, prunes old files (keeps newest 10), applies the PNG on Windows via `wallpaper-set.ps1`, then exits.

---

### Resource Usage

| Resource | Expected Usage |
|----------|---------------|
| Playwright Chromium | ~50 MB resident in the node process tree (persistent browser) |
| PowerShell (wallpaper apply) | Short-lived (<1 second per apply), ~30 MB peak |
| Disk | Up to ~80 MB for 10 retained PNGs (3–8 MB each) |
| CPU (cron schedule only) | Negligible — fires every 30 minutes |

---

### Troubleshooting

#### PNGs appear in `data/` but Win+D shows the old wallpaper

**Cause:** Service running as LocalSystem (Session 0) — `IDesktopWallpaper` silently no-ops.

**Fix:** Re-run `nssm-install.ps1` with `-LogonUser '.\<username>'` (see NSSM Session 0 Fix above), or set up the Task Scheduler alternative.

To set ObjectName without re-running the full install (existing service only):

```powershell
nssm set $ServiceName ObjectName .\<username>
nssm restart CaseCalendar
```

#### Worker log shows `wallpaper: browser launch failed at startup`

**Cause:** Playwright Chromium binary not installed.

**Fix:**

```powershell
npx playwright install --with-deps chromium
```

#### Worker log shows `wallpaper: screenshot failed` with `TimeoutError: navigation`

**Cause:** Hono server not yet listening on port 3747 when the worker attempted to fetch `/wallpaper` (race during NSSM service restart).

**Fix:** Self-corrects on the next cron tick (within 30 minutes) or on the next deadline mutation. If the error persists:

```powershell
nssm status CaseCalendar
netstat -ano | findstr 3747
```

---

## SAFE Checklist Summary

Every SAFE requirement has an automated proof test. Run `cross-env TZ=America/Los_Angeles npm test` to confirm all pass.

| ID | Description | Proof |
|----|-------------|-------|
| SAFE-01 | Date round-trip across US timezones | src/server/tz.test.ts |
| SAFE-02 | DST boundary correctness | src/server/tz.test.ts |
| SAFE-03 | No raw new Date(string) outside date util | tests/date-guard.test.ts |
| SAFE-04 | SQLite PRAGMA on startup (WAL + foreign_keys) | src/server/db.test.ts |
| SAFE-05 | VACUUM INTO backup + 30-day retention | src/server/backup.test.ts |
| SAFE-06 | Persistent error banner on 500 | src/client/App.crud.test.tsx |
| SAFE-07 | Hono binds 127.0.0.1 only | tests/safe-07-bind-loopback.test.ts |
| SAFE-08 | CORS explicit allowlist | src/server/cors.test.ts |
| SAFE-09 | No external network in src/client | tests/safe-09-no-external-network.test.ts |
| SAFE-10 | req.user middleware placeholder | src/server/user-middleware.test.ts |

For the full Windows smoke acceptance procedure (OPS-04 reboot test, per-timezone SAFE-01/02 runs, SAFE-05/06 manual checks), see Task 6 of `.planning/phases/06-safety-hardening-windows-service/06-04-PLAN.md`.
