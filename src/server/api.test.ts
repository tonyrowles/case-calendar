import { describe, it, expect, beforeEach } from 'vitest'
import { app } from './index.js'
import { sqlite } from './db.js'

// Seed a deadline_types row so FK constraint passes
function seedOneType(): void {
  sqlite
    .prepare('INSERT OR IGNORE INTO deadline_types (id, name, color) VALUES (?, ?, ?)')
    .run(1, 'Filing', '#1D4ED8')
}

// Wipe both tables between tests to avoid state leakage
function cleanTables(): void {
  sqlite.exec('DELETE FROM deadlines')
  sqlite.exec('DELETE FROM deadline_types')
}

describe('API end-to-end: POST /api/deadlines + GET /api/deadlines', () => {
  beforeEach(() => {
    cleanTables()
    seedOneType()
  })

  it('POST valid payload returns 201 with the inserted deadline shape', async () => {
    const res = await app.request('/api/deadlines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: '2026-06-15', caseLabel: 'Smith v. Jones', typeId: 1 }),
    })
    expect(res.status).toBe(201)
    const body = await res.json() as Record<string, unknown>
    expect(body.id).toBeDefined()
    expect(body.date).toBe('2026-06-15')
    expect(body.caseLabel).toBe('Smith v. Jones')
    expect(body.typeId).toBe(1)
  })

  it('GET /api/deadlines returns array containing inserted row', async () => {
    // Insert one deadline first
    await app.request('/api/deadlines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: '2026-06-15', caseLabel: 'Case A', typeId: 1 }),
    })

    const res = await app.request('/api/deadlines')
    expect(res.status).toBe(200)
    const body = await res.json() as unknown[]
    expect(Array.isArray(body)).toBe(true)
    expect(body.length).toBe(1)
  })

  it('POST invalid payload returns 422 with validation_failed error shape', async () => {
    const res = await app.request('/api/deadlines', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: 'bad-date', caseLabel: '', typeId: 0 }),
    })
    expect(res.status).toBe(422)
    const body = await res.json() as { error: { code: string; message: string } }
    expect(body.error.code).toBe('validation_failed')
    expect(typeof body.error.message).toBe('string')
  })

  it('uncaught throw returns internal_error shape — never the original error message', async () => {
    // Mount a test route that deliberately throws
    const { Hono } = await import('hono')
    const { createErrorHandler } = await import('./middleware/error-shape.js')
    const { userContextMiddleware } = await import('./middleware/user-context.js')

    const testApp = new Hono()
    testApp.use('*', userContextMiddleware)
    testApp.onError(createErrorHandler())
    testApp.get('/boom', () => {
      throw new Error('secret internal error message')
    })

    const res = await testApp.request('/boom')
    expect(res.status).toBe(500)
    const body = await res.json() as { error: { code: string; message: string } }
    expect(body.error.code).toBe('internal_error')
    // Must NOT leak the original error message
    expect(body.error.message).not.toContain('secret internal error message')
    // Must NOT include stack trace
    const bodyText = JSON.stringify(body)
    expect(bodyText).not.toContain('stack')
  })
})

describe('REMOTE-04: GET /api/identity debug endpoint', () => {
  it('returns 200 with { user: "local" } when no Tailscale-User-Login header present', async () => {
    const res = await app.request('/api/identity')
    expect(res.status).toBe(200)
    const body = await res.json() as { user: string }
    expect(body.user).toBe('local')
  })

  it('returns 200 with the Tailscale-User-Login header value when present', async () => {
    const res = await app.request('/api/identity', { headers: { 'Tailscale-User-Login': 'lawyer@example.com' } })
    expect(res.status).toBe(200)
    const body = await res.json() as { user: string }
    expect(body.user).toBe('lawyer@example.com')
  })
})
