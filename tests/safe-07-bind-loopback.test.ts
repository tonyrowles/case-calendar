/**
 * SAFE-07: Hono server binds 127.0.0.1, never 0.0.0.0.
 *
 * Verifies that starting the Hono server via @hono/node-server's serve() with
 * hostname '127.0.0.1' results in the bound address being '127.0.0.1' (not
 * '0.0.0.0' or '::'), ensuring the service is only accessible on the local
 * loopback interface — never exposed to external networks.
 *
 * The test uses port 0 (OS-assigned) to avoid port conflicts with the dev server.
 * It closes the server immediately after the address assertion.
 *
 * Pattern: uses app.request() in-process for fast tests; uses serve() only
 * for the bind-address check (same pattern as src/server/cors.test.ts).
 *
 * Wave 0 (this file): RED stub — fails immediately with a MISSING message.
 * Wave 1 (Plan 02): Implements real serve() bind + address assertion + server.close().
 */
import { describe, it, expect } from 'vitest'

describe('SAFE-07: Hono server binds 127.0.0.1, never 0.0.0.0', () => {
  it('serve() with hostname 127.0.0.1 reports address 127.0.0.1 (not 0.0.0.0 or ::)', () => {
    expect.fail(
      'MISSING — Wave 1 will implement: Plan 02 will import { serve } from \'@hono/node-server\' and { app } from \'../src/server/index.js\', call serve({ fetch: app.fetch, port: 0, hostname: \'127.0.0.1\' }), assert server.address().address === \'127.0.0.1\', then server.close()'
    )
  })
})
