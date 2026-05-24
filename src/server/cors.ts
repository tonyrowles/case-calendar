// SAFE-08: Phase 6 — CORS allowlist tightens in production to the single
// loopback-served origin. Vite dev origins are explicitly excluded because
// the dev server does not run alongside the production NSSM service.
//
// DEV vs PRODUCTION asymmetry (intentional):
//   In dev, both 'http://localhost:3747' and 'http://127.0.0.1:3747' are allowed
//   so that the browser can reach the Hono server regardless of how it resolves
//   the loopback address. In production, ONLY 'http://127.0.0.1:3747' is in the
//   allowlist — 'http://localhost:3747' is intentionally absent. This means a
//   browser making a cross-origin request with 'Origin: http://localhost:3747'
//   will be rejected in production even though localhost resolves to 127.0.0.1
//   via the hosts file. The production NSSM service binds 127.0.0.1 and the
//   SPA is served from 127.0.0.1:3747, so the Origin the browser sends for
//   same-origin requests will be 'http://127.0.0.1:3747' — matching the allowlist.
//   If you ever find CORS failures in production against localhost:3747, add it
//   to PROD_ORIGINS here and update the cors.test.ts assertions accordingly.

// REMOTE-03: optional env var that extends PROD_ORIGINS with http+https variants
// of a tailnet hostname (Phase 8). Read at module load, never at request time,
// to keep CORS behavior deterministic per process start.
const TAILSCALE_HOSTNAME = process.env.TAILSCALE_HOSTNAME?.trim() ?? ''

const PROD_ORIGINS: string[] = ['http://127.0.0.1:3747']
if (TAILSCALE_HOSTNAME) {
  PROD_ORIGINS.push(`http://${TAILSCALE_HOSTNAME}`)
  PROD_ORIGINS.push(`https://${TAILSCALE_HOSTNAME}`)
}

const DEV_ORIGINS = [
  'http://127.0.0.1:5173',  // Vite dev server via IP
  'http://localhost:5173',   // Vite dev server via hostname
  'http://127.0.0.1:3747',  // Production self-serve via IP (also used by dev for SSR-like tests)
  'http://localhost:3747',   // Production self-serve via hostname (dev only — absent in PROD_ORIGINS)
] as const

export const CORS_ORIGINS: readonly string[] =
  process.env.NODE_ENV === 'production' ? PROD_ORIGINS : DEV_ORIGINS

export const TAILSCALE_CORS_HOSTNAME = TAILSCALE_HOSTNAME
