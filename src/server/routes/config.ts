// Settings > Setup: GET/PUT /api/config (values formerly only in .env.local) and service status.
import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { CONFIG_KEYS, SYSTEM_TIME_ZONE, configView, isConfigKey, saveConfig, type ConfigKey } from '../lib/config.js'
import { applyConfigChanges } from '../services.js'
import { llmConfigured, llmProvider } from '../lib/llm.js'
import { emailDigestStatus } from '../workers/email.js'
import { emailImportConfig, emailImportStatus } from '../workers/email-import.js'
import { wallpaperWorkerRunning } from '../workers/wallpaper.js'
import { type AppVariables } from '../middleware/user-context.js'
import { logger } from '../logger.js'

export const configRouter = new Hono<{ Variables: AppVariables }>()

function view() {
  return {
    fields: configView(),
    defaultTimeZone: SYSTEM_TIME_ZONE,
    status: {
      ai: { provider: llmProvider(), configured: llmConfigured() },
      digest: emailDigestStatus(),
      emailImport: { enabled: emailImportConfig() !== null, lastCheck: emailImportStatus() },
      wallpaper: { running: wallpaperWorkerRunning() },
    },
  }
}

configRouter.get('/config', (c) => c.json(view()))

const putSchema = z.object({
  values: z.record(z.string(), z.string().max(2000)).refine(v => Object.keys(v).length > 0, 'Nothing to save'),
})

// PUT /api/config { values: { NAME: "value" } }  ('' = not set)
configRouter.put(
  '/config',
  zValidator('json', putSchema, (result, c) => {
    if (!result.success) return c.json({ error: { code: 'validation_failed', message: 'Nothing to save.' } }, 422)
  }),
  async (c) => {
    const { values } = c.req.valid('json')
    const unknown = Object.keys(values).filter(k => !isConfigKey(k))
    if (unknown.length > 0) {
      return c.json({ error: { code: 'validation_failed', message: `Unknown setting: ${unknown.join(', ')}` } }, 422)
    }
    const result = saveConfig(values as Partial<Record<ConfigKey, string>>)
    if ('errors' in result) {
      return c.json({ error: { code: 'validation_failed', message: 'Some values are not valid.', fields: result.errors } }, 422)
    }
    try {
      await applyConfigChanges(result.changed)
    } catch (err) {
      logger.error({ err, changed: result.changed }, 'config: restarting services failed')
    }
    logger.info({ changed: result.changed }, 'config: saved')   // names only, never values
    return c.json(view())
  }
)

export { CONFIG_KEYS }
