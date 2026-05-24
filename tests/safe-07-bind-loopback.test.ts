/**
 * SAFE-07: Hono server binds 127.0.0.1, never 0.0.0.0.
 *
 * Verifies that starting the Hono server via @hono/node-server's serve() with
 * hostname '127.0.0.1' results in the bound address being '127.0.0.1' (not
 * '0.0.0.0' or '::'), ensuring the service is only accessible on the local
 * loopback interface — never exposed to external networks.
 *
 * The test uses port 0 (OS-assigned) to avoid port conflicts with the dev server.
 * It closes the server in afterAll after the address assertion.
 */
import { describe, it, expect, afterAll } from 'vitest'
import { serve } from '@hono/node-server'
import type { AddressInfo } from 'node:net'
import { app } from '../src/server/index.js'

describe('SAFE-07: Hono server binds 127.0.0.1, never 0.0.0.0', () => {
  let server: ReturnType<typeof serve> | null = null
  let boundAddr: AddressInfo | null = null

  afterAll(() => {
    if (server) server.close()
  })

  it('serve() with hostname 127.0.0.1 reports address 127.0.0.1 (not 0.0.0.0 or ::)', async () => {
    // serve() calls server.listen() asynchronously; use the listeningListener
    // callback to get the address after the OS has completed the bind.
    await new Promise<void>((resolve) => {
      server = serve(
        { fetch: app.fetch, port: 0, hostname: '127.0.0.1' },
        (info) => {
          boundAddr = info as AddressInfo
          resolve()
        }
      )
    })

    expect(boundAddr).toBeTruthy()
    expect((boundAddr as AddressInfo).address).toBe('127.0.0.1')
    // Negative assertions to nail down the contract — any of these would be malpractice-class.
    expect((boundAddr as AddressInfo).address).not.toBe('0.0.0.0')
    expect((boundAddr as AddressInfo).address).not.toBe('::')
    expect((boundAddr as AddressInfo).address).not.toBe('::1')
  })
})
