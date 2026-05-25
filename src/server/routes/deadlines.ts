import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import { deadlineCreateSchema, deadlineUpdateSchema } from '../../shared/schemas/deadline.js'
import { createDeadline, getAllDeadlines, getAllDeadlineTypes, updateDeadline, deleteDeadline } from '../queries.js'
import { type AppVariables } from '../middleware/user-context.js'
import { logger } from '../logger.js'
import { registerIcsRoute } from './deadlines.ics.js'
import { parseDeadline, ParserUnconfiguredError, ParserFailedError, ParserTimeoutError } from '../lib/nl-parser.js'
import { parseLocalDate, toISODateString } from '../../shared/lib/date.js'

// Schema for POST /api/deadlines/parse request body
const parseBodySchema = z.object({
  text: z.string().min(1).max(500),
})

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

// POST /api/deadlines/parse — NL-02: parse free text into a structured deadline
deadlinesRouter.post(
  '/deadlines/parse',
  zValidator('json', parseBodySchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: { code: 'validation_failed', message: 'text must be a string between 1 and 500 characters.' } },
        422
      )
    }
  }),
  async (c) => {
    // T-11-02-AUTH: pre-flight env check BEFORE calling parseDeadline
    // Test 11-02-08 asserts parseDeadline is NOT called in this path
    if (!process.env.ANTHROPIC_API_KEY) {
      return c.json(
        { error: { code: 'parser_unconfigured', message: 'Set ANTHROPIC_API_KEY in .env.local to enable NL parsing.' } },
        503
      )
    }

    const { text } = c.req.valid('json')
    const types = getAllDeadlineTypes()
    const typeNames = types.map((t) => t.name)
    // SAFE-03: new Date() with no string arg is allowed (only string-arg forms are guarded)
    const today = toISODateString(new Date())

    try {
      const parsed = await parseDeadline(text, typeNames, today)

      // T-11-02-HALLUCINATE-DATE: SAFE-03 honoring — regex + parseLocalDate round-trip
      // SAFE-03: always use parseLocalDate(isoString), not the Date constructor with a string arg
      if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.date) || parseLocalDate(parsed.date) === null) {
        logger.warn({ date: parsed.date }, 'nl-parse: invalid date from LLM')
        return c.json(
          { error: { code: 'parse_failed', message: 'Parser returned an invalid date. Try rewording.' } },
          422
        )
      }

      // T-11-02-HALLUCINATE-TYPE: case-insensitive match → Other fallback (DATA-05 guarantees Other exists)
      const normalized = parsed.typeName.toLowerCase()
      const matched = types.find((t) => t.name.toLowerCase() === normalized)
      const otherType = types.find((t) => t.name.toLowerCase() === 'other')
      const typeId = matched?.id ?? otherType?.id
      if (!typeId) {
        return c.json(
          { error: { code: 'parse_failed', message: 'No deadline types configured.' } },
          422
        )
      }

      logger.info(
        { inputLength: text.length, caseLabel: parsed.caseLabel, typeId, date: parsed.date },
        'nl-parse: route success'
      )
      return c.json({
        caseLabel: parsed.caseLabel,
        typeId,
        date: parsed.date,
        description: parsed.description,
      })
    } catch (err) {
      if (err instanceof ParserUnconfiguredError) {
        logger.warn('nl-parse: ParserUnconfiguredError despite env-set guard')
        return c.json(
          { error: { code: 'parser_unconfigured', message: 'Set ANTHROPIC_API_KEY in .env.local to enable NL parsing.' } },
          503
        )
      }
      if (err instanceof ParserTimeoutError) {
        logger.warn({ err }, 'nl-parse: timeout')
        return c.json(
          { error: { code: 'parser_timeout', message: 'Parser timed out. Try again.' } },
          504
        )
      }
      if (err instanceof ParserFailedError) {
        logger.warn({ err }, 'nl-parse: parse failed')
        return c.json(
          { error: { code: 'parse_failed', message: 'Could not parse the deadline. Try rewording.' } },
          422
        )
      }
      logger.error({ err }, 'nl-parse: unexpected error')
      return c.json(
        { error: { code: 'parse_failed', message: 'Parsing failed unexpectedly.' } },
        500
      )
    }
  }
)

// Mount the iCal feed handler LAST — after all :id-parameterized routes
// to document intent (literal path /deadlines.ics is distinct from /deadlines/:id in Hono)
registerIcsRoute(deadlinesRouter)
