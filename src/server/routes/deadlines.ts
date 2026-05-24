import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { deadlineCreateSchema, deadlineUpdateSchema } from '../../shared/schemas/deadline.js'
import { createDeadline, getAllDeadlines, updateDeadline, deleteDeadline } from '../queries.js'
import { type AppVariables } from '../middleware/user-context.js'
import { logger } from '../logger.js'
import { registerIcsRoute } from './deadlines.ics.js'

export const deadlinesRouter = new Hono<{ Variables: AppVariables }>()

deadlinesRouter.get('/deadlines', (c) => {
  try {
    const data = getAllDeadlines()
    return c.json(data)
  } catch (err) {
    logger.error({ err }, 'GET /deadlines failed')
    return c.json({ error: { code: 'db_error', message: 'Database read failed.' } }, 500)
  }
})

deadlinesRouter.post(
  '/deadlines',
  zValidator('json', deadlineCreateSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: { code: 'validation_failed', message: 'One or more fields are invalid.' } },
        422
      )
    }
  }),
  (c) => {
    // SAFE-10: read c.get('user') — always 'local' in Phase 1 (wired by userContextMiddleware)
    const _user = c.get('user')
    const data = c.req.valid('json')
    try {
      const deadline = createDeadline(data)
      return c.json(deadline, 201)
    } catch (err) {
      logger.error({ err }, 'POST /deadlines failed')
      return c.json({ error: { code: 'db_error', message: "Couldn't save to database." } }, 500)
    }
  }
)

// PATCH /api/deadlines/:id — partial update (CRUD-03/05/07)
deadlinesRouter.patch(
  '/deadlines/:id',
  zValidator('json', deadlineUpdateSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: { code: 'validation_failed', message: 'One or more fields are invalid.' } },
        422
      )
    }
  }),
  (c) => {
    // Validate id BEFORE reading the validated body (Common Pitfall #7)
    const id = parseInt(c.req.param('id'), 10)
    if (!Number.isInteger(id) || id <= 0) {
      return c.json({ error: { code: 'validation_failed', message: 'Invalid id' } }, 400)
    }
    const patch = c.req.valid('json')
    try {
      const updated = updateDeadline(id, patch)
      if (!updated) {
        return c.json({ error: { code: 'not_found', message: 'Deadline not found' } }, 404)
      }
      return c.json(updated)
    } catch (err) {
      logger.error({ err, id }, 'PATCH /deadlines/:id failed')
      return c.json({ error: { code: 'db_error', message: "Couldn't update deadline." } }, 500)
    }
  }
)

// DELETE /api/deadlines/:id — hard delete (CRUD-04)
deadlinesRouter.delete('/deadlines/:id', (c) => {
  const id = parseInt(c.req.param('id'), 10)
  if (!Number.isInteger(id) || id <= 0) {
    return c.json({ error: { code: 'validation_failed', message: 'Invalid id' } }, 400)
  }
  try {
    const ok = deleteDeadline(id)
    if (!ok) {
      return c.json({ error: { code: 'not_found', message: 'Deadline not found' } }, 404)
    }
    return c.body(null, 204)
  } catch (err) {
    logger.error({ err, id }, 'DELETE /deadlines/:id failed')
    return c.json({ error: { code: 'db_error', message: "Couldn't delete deadline." } }, 500)
  }
})

// Mount the iCal feed handler LAST — after all :id-parameterized routes
// to document intent (literal path /deadlines.ics is distinct from /deadlines/:id in Hono)
registerIcsRoute(deadlinesRouter)
