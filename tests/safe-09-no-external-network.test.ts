/**
 * SAFE-09: No external network hostnames in src/client source.
 *
 * Scans every TypeScript/TSX file in src/client/ (excluding *.test.*) for
 * http(s):// URLs that point to external hosts (anything other than 127.0.0.1
 * or localhost). This prevents accidental data leakage or external service
 * dependencies in the client bundle — all API calls must route through the
 * local Hono server.
 *
 * Escape hatch: lines tagged with `// allow-external: <reason>` are excluded.
 * This escape hatch is reserved for Phase 8 (Tailscale remote access) and must
 * be justified in a code review before merging.
 *
 * Pattern: uses globSync (tinyglobby, already installed as transitive dep) and
 * fs.readFileSync per file — same approach as tests/type-color-source.test.ts.
 */
import { describe, it, expect } from 'vitest'
import { globSync } from 'tinyglobby'
import fs from 'node:fs'

const ALLOW_TAG = /\/\/\s*allow-external:/
const EXTERNAL_HOST_RX = /https?:\/\/(?!127\.0\.0\.1|localhost)[a-zA-Z0-9.\-]+/g

describe('SAFE-09: no external network in src/client', () => {
  it('src/client/**/*.{ts,tsx} contains no http(s) hostnames other than loopback', () => {
    const files = globSync('src/client/**/*.{ts,tsx}', { ignore: ['**/*.test.*'] })
    expect(files.length).toBeGreaterThan(0) // sanity: glob must match real files

    const offenders: Array<{ file: string; line: number; match: string }> = []
    for (const file of files) {
      const lines = fs.readFileSync(file, 'utf-8').split('\n')
      lines.forEach((l, i) => {
        if (ALLOW_TAG.test(l)) return
        const hits = l.match(EXTERNAL_HOST_RX)
        if (hits) hits.forEach(m => offenders.push({ file, line: i + 1, match: m }))
      })
    }

    expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([])
  })
})
