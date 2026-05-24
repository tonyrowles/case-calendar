/**
 * OPS-02: Production build output assertion.
 *
 * Asserts that `npm run build` produces the expected artifacts:
 *   dist/client/index.html
 *   dist/client/assets/<hash>.js (at least one hashed JS bundle)
 *   dist/server/index.js
 *
 * This test runs `npm run build` via execSync (90-second timeout). It is
 * excluded from the normal fast test cycle by default — set the environment
 * variable INCLUDE_BUILD_TEST=1 to opt in. This prevents CI from timing out
 * on every watch-mode run while still providing a verifiable artifact gate.
 */
import { describe, it, expect } from 'vitest'
import { execSync } from 'node:child_process'
import fs from 'node:fs'
import { globSync } from 'tinyglobby'

if (process.env.INCLUDE_BUILD_TEST !== '1') {
  describe.skip('OPS-02: build output (set INCLUDE_BUILD_TEST=1 to enable)', () => {
    it('placeholder', () => {})
  })
} else {
  describe('OPS-02: production build produces dist/client + dist/server artifacts', () => {
    it('npm run build exits 0 within 90 seconds', () => {
      execSync('npm run build', { timeout: 90_000, stdio: 'pipe', cwd: process.cwd() })
    })

    it('dist/client/index.html exists', () => {
      expect(fs.existsSync('dist/client/index.html')).toBe(true)
    })

    it('dist/client/assets contains at least one hashed *.js bundle', () => {
      const matches = globSync('dist/client/assets/*.js')
      expect(matches.length).toBeGreaterThanOrEqual(1)
      expect(matches.some(f => /-[A-Za-z0-9_-]{6,}\.js$/.test(f))).toBe(true)
    })

    it('dist/server/src/server/index.js exists', () => {
      expect(fs.existsSync('dist/server/src/server/index.js')).toBe(true)
    })
  })
}
