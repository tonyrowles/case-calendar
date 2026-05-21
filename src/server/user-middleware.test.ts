import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { userContextMiddleware, type AppVariables } from './middleware/user-context.js'

describe('SAFE-10: user context middleware', () => {
  it('c.get("user") returns "local" inside a handler', async () => {
    const app = new Hono<{ Variables: AppVariables }>()
    app.use('*', userContextMiddleware)
    app.get('/', (c) => {
      return c.json({ user: c.get('user') })
    })

    const res = await app.request('/')
    expect(res.status).toBe(200)
    const body = await res.json() as { user: string }
    expect(body.user).toBe('local')
  })
})
