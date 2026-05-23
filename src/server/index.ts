// DATA-06: TZ must be set before any date-dependent code loads.
// cross-env TZ=America/Los_Angeles in npm scripts handles this for dev/test.
// Set it here as a belt-and-suspenders guard for direct Node.js invocations.
process.env.TZ = 'America/Los_Angeles'

import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
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

// SAFE-08: Only listed origins may receive responses
app.use('*', cors({ origin: CORS_ORIGINS, credentials: false }))

// SAFE-10: Set req.user='local' on every request
app.use('*', userContextMiddleware)

// SAFE-06 + V7: Global error handler — never leaks stack traces to client
app.onError(createErrorHandler())

// Routes
app.route('/api', deadlinesRouter)
app.route('/api', deadlineTypesRouter)
app.route('/api', caseLabelsRouter)

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
