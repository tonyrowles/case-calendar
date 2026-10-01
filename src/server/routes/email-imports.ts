import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { emailAcceptSchema, type EmailInbox } from '../../shared/schemas/email-imports.js'
import { acceptEmailImport, getEmailImport, listEmailImports, setEmailImportStatus } from '../queries.js'
import { checkEmailNow, emailImportConfig, emailImportStatus } from '../workers/email-import.js'
import { type AppVariables } from '../middleware/user-context.js'
import { logger } from '../logger.js'

// The app's Inbox: emailed orders waiting for review.
export const emailImportsRouter = new Hono<{ Variables: AppVariables }>()

function inbox(): EmailInbox {
  const cfg = emailImportConfig()
  return { enabled: cfg !== null, address: cfg?.address ?? null, items: listEmailImports(), lastCheck: emailImportStatus() }
}

// GET /api/email-imports -> { enabled, address, items, lastCheck }
emailImportsRouter.get('/email-imports', (c) => {
  try {
    return c.json(inbox())
  } catch (err) {
    logger.error({ err }, 'GET /email-imports failed')
    return c.json({ error: { code: 'db_error', message: 'Database read failed.' } }, 500)
  }
})

// POST /api/email-imports/check -> check the mailbox now, then the inbox
emailImportsRouter.post('/email-imports/check', async (c) => {
  await checkEmailNow()
  return c.json(inbox())
})

function idParam(raw: string): number | null {
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

// POST /api/email-imports/:id/accept { deadlines } -> 201 { created } (saves + marks done atomically)
emailImportsRouter.post(
  '/email-imports/:id/accept',
  zValidator('json', emailAcceptSchema, (result, c) => {
    if (!result.success) {
      return c.json({ error: { code: 'validation_failed', message: 'One or more deadlines are invalid (check dates, cases and types).' } }, 422)
    }
  }),
  (c) => {
    const id = idParam(c.req.param('id'))
    const item = id ? getEmailImport(id) : null
    if (!id || !item) return c.json({ error: { code: 'not_found', message: 'That email is not in the inbox.' } }, 404)
    if (item.status !== 'pending') {
      return c.json({ error: { code: 'conflict', message: 'That email was already handled.' } }, 409)
    }
    try {
      return c.json({ created: acceptEmailImport(id, c.req.valid('json').deadlines) }, 201)
    } catch (err) {
      logger.error({ err }, 'POST /email-imports/:id/accept failed')
      return c.json({ error: { code: 'db_error', message: "Couldn't save the deadlines. Nothing was saved." } }, 500)
    }
  }
)

// POST /api/email-imports/:id/dismiss -> 204
emailImportsRouter.post('/email-imports/:id/dismiss', (c) => {
  const id = idParam(c.req.param('id'))
  if (!id || !setEmailImportStatus(id, 'dismissed')) {
    return c.json({ error: { code: 'not_found', message: 'That email is not in the inbox.' } }, 404)
  }
  return c.body(null, 204)
})
