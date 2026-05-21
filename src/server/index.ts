import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import './db.js'                          // side-effect: opens the DB, runs PRAGMAs
import { deadlinesRouter } from './routes/deadlines.js'
import { deadlineTypesRouter } from './routes/deadline-types.js'

const app = new Hono()
app.route('/api', deadlinesRouter)
app.route('/api', deadlineTypesRouter)

serve(
  {
    fetch: app.fetch,
    hostname: '127.0.0.1',   // SAFE-07: never 0.0.0.0
    port: 3747,
  },
  (info) => {
    console.log(`Server listening on http://${info.address}:${info.port}`)
  }
)
