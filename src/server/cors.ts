// SAFE-08: Phase 6 — CORS allowlist tightens in production to the single
// loopback-served origin. Vite dev origins are explicitly excluded because
// the dev server does not run alongside the production NSSM service.
const PROD_ORIGINS = ['http://127.0.0.1:3747'] as const

const DEV_ORIGINS = [
  'http://127.0.0.1:5173',  // Vite dev server via IP
  'http://localhost:5173',   // Vite dev server via hostname
  'http://127.0.0.1:3747',  // Production self-serve via IP (also used by dev for SSR-like tests)
  'http://localhost:3747',   // Production self-serve via hostname
] as const

export const CORS_ORIGINS: readonly string[] =
  process.env.NODE_ENV === 'production' ? PROD_ORIGINS : DEV_ORIGINS
