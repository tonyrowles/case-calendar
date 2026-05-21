import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { deadlineCreateSchema } from '../../shared/schemas/deadline.js'
import { createDeadline, getAllDeadlines } from '../queries.js'

type AppVariables = { Variables: { user: string } }

export const deadlinesRouter = new Hono<AppVariables>()

deadlinesRouter.get('/deadlines', (c) => {
  try {
    const data = getAllDeadlines()
    return c.json(data)
  } catch (_err) {
    return c.json({ error: { code: 'db_error', message: 'Database read failed' } }, 500)
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
    const data = c.req.valid('json')
    try {
      const deadline = createDeadline(data)
      return c.json(deadline, 201)
    } catch (_err) {
      return c.json({ error: { code: 'db_error', message: "Couldn't save to database." } }, 500)
    }
  }
)
