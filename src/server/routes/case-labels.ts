import { Hono } from 'hono'
import { listDistinctCaseLabels } from '../queries.js'
import { type AppVariables } from '../middleware/user-context.js'
import { logger } from '../logger.js'

export const caseLabelsRouter = new Hono<{ Variables: AppVariables }>()

caseLabelsRouter.get('/case-labels', (c) => {
  try {
    return c.json(listDistinctCaseLabels())
  } catch (err) {
    logger.error({ err }, 'GET /case-labels failed')
    return c.json({ error: { code: 'db_error', message: 'Database read failed.' } }, 500)
  }
})
