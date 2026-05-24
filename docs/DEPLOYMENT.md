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
