import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { caseArchiveSchema, caseRenameSchema } from '../../shared/schemas/cases.js'
import { listCases, renameCase, setCaseArchived } from '../queries.js'
import { type AppVariables } from '../middleware/user-context.js'
import { logger } from '../logger.js'

// Settings > Cases: case summaries, rename/merge, archive.
export const casesRouter = new Hono<{ Variables: AppVariables }>()

const invalid = { error: { code: 'validation_failed', message: 'One or more fields are invalid.' } }
const writeFailed = { error: { code: 'db_error', message: "Couldn't save to database." } }

// GET /api/cases -> [{ caseLabel, openCount, totalCount, archived }]
casesRouter.get('/cases', (c) => {
  try {
    return c.json(listCases())
  } catch (err) {
    logger.error({ err }, 'GET /cases failed')
    return c.json({ error: { code: 'db_error', message: 'Database read failed.' } }, 500)
  }
})

// POST /api/cases/rename { from, to } -> { changed } | 404 when no deadline uses `from`
casesRouter.post(
  '/cases/rename',
  zValidator('json', caseRenameSchema, (result, c) => {
    if (!result.success) return c.json(invalid, 422)
  }),
  (c) => {
    const { from, to } = c.req.valid('json')
    try {
      const changed = renameCase(from, to)
      if (changed === 0) {
        return c.json({ error: { code: 'not_found', message: 'No deadlines use that case name.' } }, 404)
      }
      return c.json({ changed })
    } catch (err) {
      logger.error({ err }, 'POST /cases/rename failed')
      return c.json(writeFailed, 500)
    }
  }
)

// PUT /api/cases/archive { caseLabel, archived } -> 204
casesRouter.put(
  '/cases/archive',
  zValidator('json', caseArchiveSchema, (result, c) => {
    if (!result.success) return c.json(invalid, 422)
  }),
  (c) => {
    const { caseLabel, archived } = c.req.valid('json')
    try {
      setCaseArchived(caseLabel, archived)
      return c.body(null, 204)
    } catch (err) {
      logger.error({ err }, 'PUT /cases/archive failed')
      return c.json(writeFailed, 500)
    }
  }
)
