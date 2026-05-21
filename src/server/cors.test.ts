import { describe, it, expect } from 'vitest'
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
