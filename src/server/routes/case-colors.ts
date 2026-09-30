import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { caseColorSetSchema } from '../../shared/schemas/caseColor.js'
import { deleteCaseColor, getAllCaseColors, setCaseColor } from '../queries.js'
import { type AppVariables } from '../middleware/user-context.js'
import { logger } from '../logger.js'

// User-chosen case colors. Case labels can contain "/" (e.g. "Glaukos/Spyglass"), so
// DELETE takes the label as a query parameter rather than a path segment.
export const caseColorsRouter = new Hono<{ Variables: AppVariables }>()

// GET /api/case-colors -> [{ caseLabel, color }]
caseColorsRouter.get('/case-colors', (c) => {
  try {
    return c.json(getAllCaseColors())
  } catch (err) {
    logger.error({ err }, 'GET /case-colors failed')
    return c.json({ error: { code: 'db_error', message: 'Database read failed.' } }, 500)
  }
})

// PUT /api/case-colors { caseLabel, color } -> 200 { caseLabel, color }
caseColorsRouter.put(
  '/case-colors',
  zValidator('json', caseColorSetSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: { code: 'validation_failed', message: 'Pick a case and one of the palette colors.' } },
        422
      )
    }
  }),
  (c) => {
    const { caseLabel, color } = c.req.valid('json')
    try {
      return c.json(setCaseColor(caseLabel, color))
    } catch (err) {
      logger.error({ err }, 'PUT /case-colors failed')
      return c.json({ error: { code: 'db_error', message: "Couldn't save to database." } }, 500)
    }
  }
)

// DELETE /api/case-colors?caseLabel=... -> 204 (back to automatic) | 404 (no override)
caseColorsRouter.delete('/case-colors', (c) => {
  const caseLabel = c.req.query('caseLabel')?.trim()
  if (!caseLabel) {
    return c.json({ error: { code: 'validation_failed', message: 'caseLabel is required.' } }, 422)
  }
  try {
    if (!deleteCaseColor(caseLabel)) {
      return c.json({ error: { code: 'not_found', message: 'That case has no custom color.' } }, 404)
    }
    return c.body(null, 204)
  } catch (err) {
    logger.error({ err }, 'DELETE /case-colors failed')
    return c.json({ error: { code: 'db_error', message: "Couldn't save to database." } }, 500)
  }
})
