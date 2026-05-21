import { createMiddleware } from 'hono/factory'

export type AppVariables = { user: string }

export const userContextMiddleware = createMiddleware<{ Variables: AppVariables }>(
  async (c, next) => {
    c.set('user', 'local')  // SAFE-10: placeholder for Phase 8 auth
    await next()
  }
)
