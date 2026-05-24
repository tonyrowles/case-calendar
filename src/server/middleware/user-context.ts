import { createMiddleware } from 'hono/factory'

export type AppVariables = { user: string }

export const userContextMiddleware = createMiddleware<{ Variables: AppVariables }>(
  async (c, next) => {
    // SAFE-10 + REMOTE-04: Tailscale-User-Login when present (injected by Tailscale Serve), else 'local' fallback
    const tailscaleLogin = c.req.header('Tailscale-User-Login')?.trim()
    c.set('user', tailscaleLogin || 'local')
    await next()
  }
)
