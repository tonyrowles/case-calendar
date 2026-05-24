/**
 * OPS-02: Hono serveStatic + SPA fallback in production mode.
 *
 * Exercises the production branch of src/server/index.ts which mounts:
 *   1. /assets/* — serveStatic with immutable cache header
 *   2. /*        — serveStatic for other static files
 *   3. notFound  — SPA fallback returning dist/client/index.html for non-API paths
 *
 * NODE_ENV=production is set before the dynamic import so the production branch
 * is evaluated. This file uses NO static import of index.ts to avoid the module
 * being loaded before NODE_ENV is set.
 *
 * Fixtures: a minimal dist/client/ tree is created in beforeAll and the asset
 * file is cleaned up in afterAll (index.html is part of the real build and left).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import type { Hono } from 'hono'
import type { AppVariables } from '../src/server/middleware/user-context.js'

describe('OPS-02: Hono serveStatic + SPA notFoundHandler in production mode', () => {
  const clientDir = path.join(process.cwd(), 'dist/client')
  const indexPath = path.join(clientDir, 'index.html')
  const assetPath = path.join(clientDir, 'assets', 'test-fixture.js')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let app: Hono<{ Variables: AppVariables }>
  let prevNodeEnv: string | undefined

  beforeAll(async () => {
    // Create fixture dist/client tree so the production block can read index.html.
    // In CI the real build may not have run yet, so we provide minimal fixtures.
    fs.mkdirSync(path.join(clientDir, 'assets'), { recursive: true })
    fs.writeFileSync(
      indexPath,
      '<!doctype html><html><head><title>fixture</title></head><body><div id="root"></div></body></html>',
      'utf-8'
    )
    fs.writeFileSync(assetPath, 'console.log("fixture")', 'utf-8')

    // Set NODE_ENV=production BEFORE importing so the production branch evaluates.
    prevNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    // Dynamic import AFTER NODE_ENV is set. Since each vitest test file runs in
    // its own worker with a fresh module cache, and test-setup.ts only imports
    // db.js (not index.ts), this dynamic import evaluates the production branch.
    const mod = await import('../src/server/index.js')
    app = mod.app
  })

  afterAll(() => {
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = prevNodeEnv
    try { fs.unlinkSync(assetPath) } catch { /* fixture cleanup — ignore if missing */ }
  })

  it('serves /assets/<file>.js with Cache-Control: public, max-age=31536000, immutable', async () => {
    const res = await app.request('/assets/test-fixture.js')
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
  })

  it('falls back to dist/client/index.html for unknown non-/api paths (SPA routes)', async () => {
    const res = await app.request('/settings')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')?.toLowerCase()).toContain('text/html')
    const body = await res.text()
    expect(body).toContain('<div id="root"></div>')
  })

  it('returns JSON 404 for unknown /api/* paths', async () => {
    const res = await app.request('/api/this-route-does-not-exist')
    expect(res.status).toBe(404)
    const ct = res.headers.get('content-type')?.toLowerCase() ?? ''
    expect(ct).toContain('application/json')
  })

  it('returns JSON 404 for bare /api path (no trailing slash) — CR-03', async () => {
    // '/api'.startsWith('/api/') is false — without the p === '/api' guard the
    // notFound handler fell through to the SPA fallback, returning 200 HTML.
    const res = await app.request('/api')
    expect(res.status).toBe(404)
    const ct = res.headers.get('content-type')?.toLowerCase() ?? ''
    expect(ct).toContain('application/json')
  })

  it('production CORS rejects Origin: http://localhost:3747 (not in production allowlist) — WR-02', async () => {
    // Dev/prod CORS asymmetry: in dev, localhost:3747 is allowed; in production
    // only 127.0.0.1:3747 is in PROD_ORIGINS. A request with Origin: localhost:3747
    // in production must receive no Access-Control-Allow-Origin header, which is
    // what this test documents and locks in. See cors.ts for full explanation.
    const res = await app.request('/api/deadlines', {
      headers: { Origin: 'http://localhost:3747' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })
})
