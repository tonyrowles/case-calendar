import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { app } from './index.js'

describe('SAFE-08: CORS middleware', () => {
  it('allowed origin http://127.0.0.1:5173 receives Access-Control-Allow-Origin header', async () => {
    const res = await app.request('/api/deadlines', {
      headers: { Origin: 'http://127.0.0.1:5173' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:5173')
  })

  it('allowed origin http://127.0.0.1:3747 receives Access-Control-Allow-Origin header', async () => {
    const res = await app.request('/api/deadlines', {
      headers: { Origin: 'http://127.0.0.1:3747' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:3747')
  })

  it('allowed origin http://localhost:5173 receives Access-Control-Allow-Origin header', async () => {
    const res = await app.request('/api/deadlines', {
      headers: { Origin: 'http://localhost:5173' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
  })

  it('allowed origin http://localhost:3747 receives Access-Control-Allow-Origin header', async () => {
    const res = await app.request('/api/deadlines', {
      headers: { Origin: 'http://localhost:3747' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:3747')
  })

  it('disallowed origin receives no Access-Control-Allow-Origin header', async () => {
    const res = await app.request('/api/deadlines', {
      headers: { Origin: 'http://evil.example.com' },
    })
    expect(res.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('OPTIONS preflight from allowed origin returns 204 with CORS headers', async () => {
    const res = await app.request('/api/deadlines', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://127.0.0.1:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    })
    expect(res.status).toBe(204)
    expect(res.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:5173')
    expect(res.headers.get('access-control-allow-methods')).toBeTruthy()
  })
})

// SAFE-08 (production): Test the CORS_ORIGINS constant directly for the production branch.
// We cannot use the cache-bust query-string dynamic import pattern here (Vitest's Vite
// transform rejects unknown query strings on local modules). Instead, we reset the module
// registry in beforeAll and re-import cors.ts with NODE_ENV=production to verify the
// production allowlist value directly — this is equivalent to (and faster than) spinning
// up a full prodApp.
describe('SAFE-08 (production): CORS allowlist locked to loopback-served origin', () => {
  let prodOrigins: readonly string[]
  let prevNodeEnv: string | undefined

  beforeAll(async () => {
    prevNodeEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    // Reset the module cache so cors.ts is re-evaluated with NODE_ENV=production.
    vi.resetModules()
    const mod = await import('./cors.js')
    prodOrigins = mod.CORS_ORIGINS
  })

  afterAll(async () => {
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = prevNodeEnv
    // Restore module cache to dev state for subsequent test files.
    vi.resetModules()
  })

  it('production allowlist contains exactly one origin', () => {
    expect(prodOrigins).toHaveLength(1)
  })

  it('production allows http://127.0.0.1:3747', () => {
    expect(prodOrigins).toContain('http://127.0.0.1:3747')
  })

  it('production REJECTS http://127.0.0.1:5173 (Vite dev origin)', () => {
    expect(prodOrigins).not.toContain('http://127.0.0.1:5173')
  })

  it('production REJECTS http://localhost:3747 (loopback-only, IP literal required)', () => {
    expect(prodOrigins).not.toContain('http://localhost:3747')
  })

  it('production REJECTS http://evil.example.com', () => {
    expect(prodOrigins).not.toContain('http://evil.example.com')
  })
})

// REMOTE-03: Test the TAILSCALE_HOSTNAME env var behavior in cors.ts.
// Each block saves/restores both NODE_ENV and TAILSCALE_HOSTNAME, calls vi.resetModules()
// in beforeAll (to force module re-evaluation) and afterAll (to restore dev state).

describe('REMOTE-03: CORS extends with TAILSCALE_HOSTNAME set', () => {
  let prodOrigins: readonly string[]
  let prevNodeEnv: string | undefined
  let prevHostname: string | undefined

  beforeAll(async () => {
    prevNodeEnv = process.env.NODE_ENV
    prevHostname = process.env.TAILSCALE_HOSTNAME
    process.env.NODE_ENV = 'production'
    process.env.TAILSCALE_HOSTNAME = 'lawyer-laptop.tail-scale.ts.net'

    vi.resetModules()
    const mod = await import('./cors.js')
    prodOrigins = mod.CORS_ORIGINS
  })

  afterAll(async () => {
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = prevNodeEnv
    if (prevHostname === undefined) delete process.env.TAILSCALE_HOSTNAME
    else process.env.TAILSCALE_HOSTNAME = prevHostname
    vi.resetModules()
  })

  it('includes http variant of TAILSCALE_HOSTNAME', () => {
    expect(prodOrigins).toContain('http://lawyer-laptop.tail-scale.ts.net')
  })

  it('includes https variant of TAILSCALE_HOSTNAME', () => {
    expect(prodOrigins).toContain('https://lawyer-laptop.tail-scale.ts.net')
  })

  it('still includes loopback origin', () => {
    expect(prodOrigins).toContain('http://127.0.0.1:3747')
  })

  it('production allowlist contains exactly three origins', () => {
    expect(prodOrigins).toHaveLength(3)
  })
})

describe('REMOTE-03: CORS unchanged when TAILSCALE_HOSTNAME is empty string', () => {
  let prodOrigins: readonly string[]
  let prevNodeEnv: string | undefined
  let prevHostname: string | undefined

  beforeAll(async () => {
    prevNodeEnv = process.env.NODE_ENV
    prevHostname = process.env.TAILSCALE_HOSTNAME
    process.env.NODE_ENV = 'production'
    process.env.TAILSCALE_HOSTNAME = ''

    vi.resetModules()
    const mod = await import('./cors.js')
    prodOrigins = mod.CORS_ORIGINS
  })

  afterAll(async () => {
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = prevNodeEnv
    if (prevHostname === undefined) delete process.env.TAILSCALE_HOSTNAME
    else process.env.TAILSCALE_HOSTNAME = prevHostname
    vi.resetModules()
  })

  it('production allowlist contains exactly one origin (Phase 6 baseline)', () => {
    expect(prodOrigins).toHaveLength(1)
  })

  it('production allowlist equals Phase 6 baseline', () => {
    expect(prodOrigins).toEqual(['http://127.0.0.1:3747'])
  })
})

describe('REMOTE-03: CORS unchanged when TAILSCALE_HOSTNAME is unset', () => {
  let prodOrigins: readonly string[]
  let prevNodeEnv: string | undefined
  let prevHostname: string | undefined

  beforeAll(async () => {
    prevNodeEnv = process.env.NODE_ENV
    prevHostname = process.env.TAILSCALE_HOSTNAME
    process.env.NODE_ENV = 'production'
    delete process.env.TAILSCALE_HOSTNAME

    vi.resetModules()
    const mod = await import('./cors.js')
    prodOrigins = mod.CORS_ORIGINS
  })

  afterAll(async () => {
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = prevNodeEnv
    if (prevHostname === undefined) delete process.env.TAILSCALE_HOSTNAME
    else process.env.TAILSCALE_HOSTNAME = prevHostname
    vi.resetModules()
  })

  it('production allowlist contains exactly one origin (Phase 6 baseline)', () => {
    expect(prodOrigins).toHaveLength(1)
  })

  it('production allows http://127.0.0.1:3747', () => {
    expect(prodOrigins).toContain('http://127.0.0.1:3747')
  })
})

describe('REMOTE-03: dev mode ignores TAILSCALE_HOSTNAME', () => {
  let devOrigins: readonly string[]
  let prevNodeEnv: string | undefined
  let prevHostname: string | undefined

  beforeAll(async () => {
    prevNodeEnv = process.env.NODE_ENV
    prevHostname = process.env.TAILSCALE_HOSTNAME
    process.env.NODE_ENV = 'development'
    process.env.TAILSCALE_HOSTNAME = 'lawyer-laptop.tail-scale.ts.net'

    vi.resetModules()
    const mod = await import('./cors.js')
    devOrigins = mod.CORS_ORIGINS
  })

  afterAll(async () => {
    if (prevNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = prevNodeEnv
    if (prevHostname === undefined) delete process.env.TAILSCALE_HOSTNAME
    else process.env.TAILSCALE_HOSTNAME = prevHostname
    vi.resetModules()
  })

  it('dev origins do NOT contain http tailscale variant', () => {
    expect(devOrigins).not.toContain('http://lawyer-laptop.tail-scale.ts.net')
  })

  it('dev origins do NOT contain https tailscale variant', () => {
    expect(devOrigins).not.toContain('https://lawyer-laptop.tail-scale.ts.net')
  })

  it('dev origins contain the standard Vite dev server origin', () => {
    expect(devOrigins).toContain('http://127.0.0.1:5173')
  })
})
