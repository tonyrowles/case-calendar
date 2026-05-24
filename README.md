# Case Calendar

A self-hosted, single-user webapp for a practicing lawyer to track every active case deadline at a glance. Local-first, no cloud, no telemetry, no auth. Runs on Windows as an NSSM service that survives reboot.

---

## Quick Start (Development)

```bash
npm install
npm run dev
# Open http://127.0.0.1:5173
```

---

## Self-host on Windows

Production deployment model: run `npm run build` once, then either `npm run start` for an ad-hoc foreground process or install as a persistent Windows service with NSSM for always-on operation.

See [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) for the cold-start Windows runbook — prerequisites, NSSM install, post-reboot verification, update procedure, and uninstall.

Stack at a glance: Node.js 22 LTS, Hono 4 + Vite 7 + React 19, SQLite via better-sqlite3, NSSM 2.24+.

---

## Remote Access

Access Case Calendar from your phone or travel laptop over your private Tailscale network — no public exposure, no app source changes.

See [docs/DEPLOYMENT.md — Remote Access via Tailscale](./docs/DEPLOYMENT.md#remote-access-via-tailscale) for the cold-start setup runbook: prerequisites, `tailscale serve` command, NSSM env var update, verification, troubleshooting.

---

## SAFE Checklist

Every safety requirement has an automated proof test. Run `cross-env TZ=America/Los_Angeles npm test` to confirm all pass.

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
