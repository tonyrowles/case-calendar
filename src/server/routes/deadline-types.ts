import { Hono } from 'hono'
import { getAllDeadlineTypes } from '../queries.js'

type AppVariables = { Variables: { user: string } }

export const deadlineTypesRouter = new Hono<AppVariables>()

deadlineTypesRouter.get('/deadline-types', (c) => {
  try {
    const data = getAllDeadlineTypes()
    return c.json(data)
  } catch (_err) {
    return c.json({ error: { code: 'db_error', message: 'Database read failed' } }, 500)
  }
})
