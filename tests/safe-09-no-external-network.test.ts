/**
 * SAFE-09: No external network hostnames in src/client source.
 *
 * Scans all TypeScript/TSX files in src/client/ for hardcoded http(s):// URLs
 * that point to external hosts (anything other than 127.0.0.1 or localhost).
 * This prevents accidental data leakage or external service dependencies in the
 * client bundle — all API calls must route through the local Hono server.
 *
 * Escape hatch: lines tagged with // allow-external: <reason> are excluded.
 * This escape hatch is reserved for Phase 8 (Tailscale remote access) and must
 * be justified in a code review before merging.
 *
 * The grep uses a regex pattern to find http:// or https:// URLs followed by
 * a hostname that is not 127.0.0.1 or localhost.
 *
 * Pattern: uses globSync (tinyglobby, already installed as transitive dep) and
 * fs.readFileSync per file — same approach as tests/type-color-source.test.ts.
 *
 * Wave 0 (this file): RED stub — fails immediately with a MISSING message.
 * Wave 1 (Plan 02): Implements real file scan with globSync + regex + escape hatch.
 */
import { describe, it, expect } from 'vitest'

describe('SAFE-09: no external network hostnames in src/client (only 127.0.0.1 or localhost allowed)', () => {
  it('src/client/**/*.{ts,tsx} contains no http(s):// URLs other than loopback or // allow-external: tagged lines', () => {
    expect.fail(
      'MISSING — Wave 1 will implement: Plan 02 will use globSync(\'src/client/**/*.{ts,tsx}\', { ignore: [\'**/*.test.*\'] }), scan each line for /https?:\\/\\/(?!127\\.0\\.0\\.1|localhost)[a-zA-Z0-9.\\-]+/g, honor // allow-external: escape hatch, and assert offenders === []'
    )
  })
})
