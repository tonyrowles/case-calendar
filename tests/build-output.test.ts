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
 *
 * Wave 0 (this file): RED stub — fails immediately with a MISSING message.
 * Wave 1 (Plan 02): Implements the real assertions using execSync + fs.existsSync.
 */
import { describe, it, expect } from 'vitest'

if (!process.env.INCLUDE_BUILD_TEST) {
  describe.skip('OPS-02: build output (skipped, set INCLUDE_BUILD_TEST=1 to enable)', () => {
    it('placeholder', () => {})
  })
} else {
  describe('OPS-02: production build produces dist/client/index.html + dist/client/assets/*.js and dist/server/index.js', () => {
    it('npm run build exits 0 and dist/client/index.html exists', () => {
      expect.fail(
        'MISSING — Wave 1 will implement: Plan 02 will run \'npm run build\' via execSync (timeout 90_000) and assert dist/client/index.html exists, dist/client/assets/ contains a hashed *.js bundle, and dist/server/index.js exists'
      )
    })
  })
}
