// Wave 1 — converted from it.todo stubs (Plan 03-01) to live tests (Plan 03-02).
//
// Route: GET /api/case-labels → string[] (sorted distinct case labels from deadlines table)
// Security: DB error returns structured 500 with db_error code
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { app } from '../index.js'
import { sqlite } from '../db.js'

// Seed a deadline_types row so FK constraint passes (mirrors api.test.ts pattern)
function seedOneType(): void {
  sqlite
    .prepare('INSERT OR IGNORE INTO deadline_types (id, name, color) VALUES (?, ?, ?)')
    .run(1, 'Filing', '#1D4ED8')
}

// Wipe both tables between tests to avoid state leakage (mirrors api.test.ts pattern)
function cleanTables(): void {
  sqlite.exec('DELETE FROM deadlines')
  sqlite.exec('DELETE FROM deadline_types')
}

describe('GET /api/case-labels — CL-series', () => {
  beforeEach(() => {
    cleanTables()
    seedOneType()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('CL1: returns sorted distinct case labels as string[] from the deadlines table', async () => {
    // Insert three deadlines with different case labels, including one duplicate caseLabel
    sqlite
      .prepare("INSERT INTO deadlines (date, caseLabel, typeId) VALUES ('2026-06-01', 'Zeta Corp', 1)")
      .run()
    sqlite
      .prepare("INSERT INTO deadlines (date, caseLabel, typeId) VALUES ('2026-06-02', 'Alpha Inc', 1)")
      .run()
    sqlite
      .prepare("INSERT INTO deadlines (date, caseLabel, typeId) VALUES ('2026-06-03', 'Beta LLC', 1)")
      .run()
    // Duplicate — should appear only once in the distinct result
    sqlite
      .prepare("INSERT INTO deadlines (date, caseLabel, typeId) VALUES ('2026-06-04', 'Alpha Inc', 1)")
      .run()

    const res = await app.request('/api/case-labels')
    expect(res.status).toBe(200)
    const body = await res.json() as string[]
    expect(Array.isArray(body)).toBe(true)
    // Sorted alphabetically, distinct
    expect(body).toEqual(['Alpha Inc', 'Beta LLC', 'Zeta Corp'])
  })

  it('CL2: empty strings are excluded from the returned label list', async () => {
    // Insert a deadline with an empty caseLabel via raw SQL (bypasses Zod min(1) API validation)
    sqlite
      .prepare("INSERT INTO deadlines (date, caseLabel, typeId) VALUES ('2026-06-01', '', 1)")
      .run()
    sqlite
      .prepare("INSERT INTO deadlines (date, caseLabel, typeId) VALUES ('2026-06-02', 'Real Case', 1)")
      .run()

    const res = await app.request('/api/case-labels')
    expect(res.status).toBe(200)
    const body = await res.json() as string[]
    // Empty string must not appear
    expect(body).not.toContain('')
    // Non-empty label must appear
    expect(body).toContain('Real Case')
  })

  it('CL3: DB error returns structured 500 response with db_error code', async () => {
    // Create a fresh Hono test app that mounts caseLabelsRouter with a stubbed query
    // that throws on call. This mirrors the api.test.ts "mount a test route" pattern.
    const { Hono } = await import('hono')
    const { createErrorHandler } = await import('../middleware/error-shape.js')
    const { userContextMiddleware } = await import('../middleware/user-context.js')
    const queriesModule = await import('../queries.js')
    const { caseLabelsRouter } = await import('./case-labels.js')

    // Spy on listDistinctCaseLabels to throw a DB error
    const spy = vi.spyOn(queriesModule, 'listDistinctCaseLabels').mockImplementation(() => {
      throw new Error('simulated db failure')
    })

    const testApp = new Hono()
    testApp.use('*', userContextMiddleware)
    testApp.onError(createErrorHandler())
    testApp.route('/api', caseLabelsRouter)

    const res = await testApp.request('/api/case-labels')
    expect(res.status).toBe(500)
    const body = await res.json() as { error: { code: string; message: string } }
    expect(body.error.code).toBe('db_error')
    expect(body.error.message).toBe('Database read failed.')

    spy.mockRestore()
  })
})
