# Case Calendar

A self-hosted, single-user webapp for a practicing lawyer to track every active case deadline at a glance. Local-first, no cloud, no telemetry, no auth. Runs on Windows as an NSSM service that survives reboot.

---

## Install (Windows 10/11)

1. Download `CaseCalendarSetup-<version>.exe` from the [latest release](../../releases/latest) and run it.
   No administrator rights, Node.js or git needed. (Windows may warn that the app is from an
   unknown publisher: choose **More info > Run anyway**.)
2. Your browser opens to **Settings > Setup**: pick your time zone, optionally add an AI key and
   email account, and turn on the desktop wallpaper.
3. Case Calendar runs from the system tray and starts when you sign in. Updates appear in the
   tray menu (**Install update**).

Your deadlines and settings live in `%LOCALAPPDATA%\CaseCalendar` and are kept across updates
and uninstall. Building the installer: see [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md#installer-and-releases).

---

## Quick Start (Development)

```bash
npm install
npm run dev
# Open http://127.0.0.1:5173
```

---

## Self-host on Windows

From a git checkout (developers): run `npm run build` once, then either `npm run start` for an ad-hoc foreground process or install as a persistent Windows service with NSSM for always-on operation.

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for the cold-start Windows runbook — prerequisites, NSSM install, post-reboot verification, update procedure, and uninstall.

Stack at a glance: Node.js 22 LTS, Hono 4 + Vite 7 + React 19, SQLite via better-sqlite3, NSSM 2.24+.

---

## Remote Access

Access Case Calendar from your phone or travel laptop over your private Tailscale network — no public exposure, no app source changes.

See [docs/DEPLOYMENT.md — Remote Access via Tailscale](./docs/DEPLOYMENT.md#remote-access-via-tailscale) for the cold-start setup runbook: prerequisites, `tailscale serve` command, NSSM env var update, verification, troubleshooting.

---

## Desktop Wallpaper

Your Windows desktop wallpaper auto-regenerates from the deadline view every 30 minutes — and within about 10 seconds of any deadline change — so the next time you press Win+D the latest case deadlines are right there. Renders at your monitor's exact resolution and display scaling, from laptops to 32:9 ultrawides, and leaves room for desktop icons.

See [docs/DEPLOYMENT.md — Desktop Wallpaper](./docs/DEPLOYMENT.md#desktop-wallpaper-phase-9) for the install runbook: Playwright Chromium install, NSSM Session 0 fix, DPI guidance, manual debug, and the Task Scheduler alternative.

---

## Email Digest

A daily 7:00 AM email digest delivers the next 14 days of deadlines plus overdue items (capped at 30 most recent) as a plain-text and HTML multipart message that renders cleanly in Outlook, Apple Mail, and terminal mail readers.

See [docs/DEPLOYMENT.md -- Email Digest](./docs/DEPLOYMENT.md#email-digest-phase-10) for setup: copy `.env.example` to `.env.local`, configure SMTP (Gmail App Password walkthrough included), and trigger a test send with `npm run email:once`.

---

## NL Quick-Add

Press Cmd+K (Ctrl+K on Windows) inside the app, type a deadline in plain English like "Smith deposition June 15", and the new-deadline form opens pre-filled — ready to review and save. Powered by Anthropic Claude. Optional: leave the API key unset and Cmd+K still opens without the parser.

See [docs/DEPLOYMENT.md — NL Quick-Add](./docs/DEPLOYMENT.md#nl-quick-add-phase-11) for the setup runbook: get an Anthropic API key, add it to `.env.local`, restart the service, and start parsing.

---

## SAFE Checklist

Every safety requirement has an automated proof test. Run `npm test` to confirm all pass.

| ID | Description | Status | Proof |
|----|-------------|--------|-------|
| SAFE-01 | Date round-trip across US timezones | ✓ | src/server/tz.test.ts |
| SAFE-02 | DST boundary correctness | ✓ | src/server/tz.test.ts |
| SAFE-03 | No raw new Date(string) outside date util | ✓ | tests/date-guard.test.ts |
| SAFE-04 | SQLite PRAGMA on startup (WAL + foreign_keys) | ✓ | src/server/db.test.ts |
| SAFE-05 | VACUUM INTO backup + 30-day retention | ✓ | src/server/backup.test.ts |
| SAFE-06 | Persistent error banner on 500 | ✓ | src/client/App.crud.test.tsx |
| SAFE-07 | Hono binds 127.0.0.1 only | ✓ | tests/safe-07-bind-loopback.test.ts |
| SAFE-08 | CORS explicit allowlist | ✓ | src/server/cors.test.ts |
| SAFE-09 | No external network in src/client | ✓ | tests/safe-09-no-external-network.test.ts |
| SAFE-10 | req.user middleware placeholder | ✓ | src/server/user-middleware.test.ts |

---

## License

Private project; no license file.
