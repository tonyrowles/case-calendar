import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { bulkCreateSchema, extractRequestSchema } from '../../shared/schemas/imports.js'
import { toISODateString } from '../../shared/lib/date.js'
import { createDeadlines, getAllDeadlineTypes, listDistinctCaseLabels } from '../queries.js'
import { ExtractorFailedError, ExtractorUnconfiguredError, extractDeadlines } from '../lib/deadline-extractor.js'
import { toProposals } from '../lib/proposals.js'
import { type AppVariables } from '../middleware/user-context.js'
import { logger } from '../logger.js'

// Import deadlines from a longer text (scheduling order, email): extract -> review -> bulk save.
export const importsRouter = new Hono<{ Variables: AppVariables }>()

const unconfigured = { error: { code: 'parser_unconfigured', message: 'Set ANTHROPIC_API_KEY in .env.local to enable importing.' } }

// POST /api/deadlines/extract { text, caseLabel? } -> { proposals } (nothing is saved)
importsRouter.post(
  '/deadlines/extract',
  zValidator('json', extractRequestSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_failed', message: result.error.issues[0]?.message ?? 'Invalid request.' } }, 422)
    }
  }),
  async (c) => {
    if (!process.env.ANTHROPIC_API_KEY) return c.json(unconfigured, 503)
    const { text, caseLabel } = c.req.valid('json')
    const types = getAllDeadlineTypes()
    const knownCases = listDistinctCaseLabels()
    try {
      const raw = await extractDeadlines({
        text,
        typeNames: types.map(t => t.name),
        knownCases,
        caseHint: caseLabel ?? null,
        // SAFE-03: new Date() with no string arg is allowed
        today: toISODateString(new Date()),
      })
      return c.json({ proposals: toProposals(raw, types, knownCases, caseLabel ?? null) })
    } catch (err) {
      if (err instanceof ExtractorUnconfiguredError) return c.json(unconfigured, 503)
      if (err instanceof ExtractorFailedError) {
        return c.json({ error: { code: 'extract_failed', message: err.message } }, 422)
      }
      logger.error({ err }, 'POST /deadlines/extract failed')
      return c.json({ error: { code: 'extract_failed', message: 'Import failed unexpectedly.' } }, 500)
    }
  }
)

// POST /api/deadlines/bulk { deadlines: [...] } -> 201 { created } (all or nothing)
importsRouter.post(
  '/deadlines/bulk',
  zValidator('json', bulkCreateSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_failed', message: 'One or more deadlines are invalid (check dates, cases and types).' } }, 422)
    }
  }),
  (c) => {
    try {
      const created = createDeadlines(c.req.valid('json').deadlines)
      return c.json({ created }, 201)
    } catch (err) {
      logger.error({ err }, 'POST /deadlines/bulk failed')
      return c.json({ error: { code: 'db_error', message: "Couldn't save the deadlines. Nothing was saved." } }, 500)
    }
  }
)
