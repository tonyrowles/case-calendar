import { Hono } from 'hono'
import { getAllDeadlineTypes } from '../queries.js'
import { type AppVariables } from '../middleware/user-context.js'

export const deadlineTypesRouter = new Hono<{ Variables: AppVariables }>()

deadlineTypesRouter.get('/deadline-types', (c) => {
  try {
    const data = getAllDeadlineTypes()
    return c.json(data)
  } catch (_err) {
    return c.json({ error: { code: 'db_error', message: 'Database read failed.' } }, 500)
  }
})
