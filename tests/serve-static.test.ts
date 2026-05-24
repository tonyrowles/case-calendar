/**
 * OPS-02: Hono serveStatic + SPA fallback in production mode.
 *
 * Two contracts that Plan 02 (Wave 1) must turn GREEN:
 *
 *   1. Hashed asset bundles (e.g. /assets/index-abc123.js) served with
 *      Cache-Control: public, max-age=31536000, immutable when NODE_ENV=production.
 *
 *   2. Unknown non-/api paths (e.g. /settings, /wallpaper) fall back to
 *      dist/client/index.html with status 200. API paths (/api/unknown) return
 *      JSON 404 (NOT the SPA fallback), preserving API error semantics.
 *
 * Pattern: uses app.request() in-process (same approach as src/server/cors.test.ts).
 * NODE_ENV is set before importing app so the production branch is exercised.
 *
 * Wave 0 (this file): RED stubs — both it() calls fail with MISSING messages.
 * Wave 1 (Plan 02): Implements fixture dist/ directory + real app.request assertions.
 */
import { describe, it, expect } from 'vitest'

describe('OPS-02: Hono serveStatic + SPA notFoundHandler in production mode', () => {
  it('serves /assets/<hashed-bundle>.js with Cache-Control: public, max-age=31536000, immutable when NODE_ENV=production', () => {
    expect.fail(
      'MISSING — Wave 1 will implement: Plan 02 will set process.env.NODE_ENV=\'production\' before importing app, then assert app.request(\'/assets/test.js\') returns immutable cache header'
    )
  })

  it('falls back to dist/client/index.html for unknown non-/api paths (SPA routes like /settings, /wallpaper)', () => {
    expect.fail(
      'MISSING — Wave 1 will implement: Plan 02 will write a fixture index.html to dist/client/, then assert app.request(\'/settings\') returns HTML with status 200 and app.request(\'/api/unknown\') returns JSON 404'
    )
  })
})
