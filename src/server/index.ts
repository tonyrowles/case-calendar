// DATA-06: TZ MUST be set in the environment before Node.js starts — not here.
// In ESM, all static import declarations are hoisted and evaluated before any
// module body code runs, so a process.env.TZ assignment at this line executes
// AFTER db.ts side effects (db open, startup backup, triggers) have already run.
// The npm scripts use `cross-env TZ=America/Los_Angeles` which sets the env var
// before the Node.js process starts, which is the only correct approach.
// For direct invocations (e.g. `node dist/server/index.js`), ensure TZ is set
// in the shell or via a wrapper: `TZ=America/Los_Angeles node dist/server/index.js`

import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import fs from 'node:fs'
import path from 'node:path'
import './db.js'                          // side-effect: opens the DB, verifies PRAGMAs, runs backup
import { deadlinesRouter } from './routes/deadlines.js'
import { deadlineTypesRouter } from './routes/deadline-types.js'
import { caseLabelsRouter } from './routes/case-labels.js'
import { logger } from './logger.js'
import { userContextMiddleware, type AppVariables } from './middleware/user-context.js'
import { createErrorHandler } from './middleware/error-shape.js'
import { CORS_ORIGINS } from './cors.js'
// seedDeadlineTypes is created by Plan 01-03 — both plans are wave 2 siblings
import { seedDeadlineTypes } from './seed.js'

export const app = new Hono<{ Variables: AppVariables }>()

// SAFE-08: Only listed origins may receive responses.
// Spread into a mutable array to satisfy Hono cors() type (readonly string[] → string[]).
app.use('*', cors({ origin: [...CORS_ORIGINS], credentials: false }))

// SAFE-10: Set req.user='local' on every request
app.use('*', userContextMiddleware)

// SAFE-06 + V7: Global error handler — never leaks stack traces to client
app.onError(createErrorHandler())

// Routes
app.route('/api', deadlinesRouter)
app.route('/api', deadlineTypesRouter)
app.route('/api', caseLabelsRouter)

// OPS-02: Production SPA serving — mount AFTER /api routes so API precedence is intact.
const isProduction = process.env.NODE_ENV === 'production'
let INDEX_HTML: string | null = null
if (isProduction) {
  const clientDir = path.join(process.cwd(), 'dist/client')
  const indexPath = path.join(clientDir, 'index.html')
  try {
    INDEX_HTML = fs.readFileSync(indexPath, 'utf-8')
  } catch (err) {
    logger.error({ err, indexPath }, 'OPS-02: dist/client/index.html missing — run `npm run build` before `npm run start`')
    throw err
  }
  // Hashed asset bundles — aggressive cache (immutable).
  // Cache-Control is set BEFORE serveStatic so the header is included in the response
  // (onFound runs after c.body() which finalizes the Response object).
  app.use('/assets/*', async (c, next) => {
    c.header('Cache-Control', 'public, max-age=31536000, immutable')
    return next()
  })
  app.use('/assets/*', serveStatic({ root: './dist/client' }))
  // Other static files (favicon, etc.) — moderate cache; index.html gets no-cache.
  app.use('/*', async (c, next) => {
    const p = c.req.path
    if (p.endsWith('.html') || p === '/') {
      c.header('Cache-Control', 'no-cache')
    } else {
      c.header('Cache-Control', 'public, max-age=86400')
    }
    return next()
  })
  app.use('/*', serveStatic({ root: './dist/client' }))
  // SPA fallback — cached index.html for any non-API, non-asset path
  app.notFound((c) => {
    const p = c.req.path
    if (p.startsWith('/api/') || p.startsWith('/assets/')) {
      return c.json({ error: { code: 'not_found', message: 'Not found' } }, 404)
    }
    return c.html(INDEX_HTML!, 200, { 'Cache-Control': 'no-cache' })
  })
}

// DATA-05: Seed default deadline types on startup (idempotent INSERT OR IGNORE)
seedDeadlineTypes()

// Start the server only when this file is the entry point (not when imported by tests)
if (process.env.VITEST !== 'true') {
  serve(
    {
      fetch: app.fetch,
      hostname: '127.0.0.1',   // SAFE-07: never 0.0.0.0
      port: 3747,
    },
    (info) => {
      logger.info(`Server listening on http://${info.address}:${info.port}`)
    }
  )
}
