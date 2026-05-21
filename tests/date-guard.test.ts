/**
 * SAFE-03: Static grep guard — no raw `new Date(string)` outside date util.
 *
 * The grep pattern targets `new Date("` and `new Date('` (string argument forms)
 * which are the dangerous patterns that cause off-by-one DST bugs.
 * Bare `new Date()` (no arguments, returns "now") is allowed in db-init.ts
 * and is excluded via `--exclude="*db-init.ts"`.
 *
 * Legitimate exclusions:
 * - src/shared/lib/date.ts — the ONLY place where date strings become Date objects
 * - *.test.ts / *.test.tsx — test files may use new Date() for setup fixtures
 * - src/server/db-init.ts — uses `new Date()` (no arg) for current time in backup/retention
 */
import { execSync } from 'node:child_process'
import { describe, it, expect } from 'vitest'

describe('SAFE-03: no raw new Date(string) calls outside date util', () => {
  it('grep finds no new Date( calls in source files outside permitted locations', () => {
    const result = execSync(
      'grep -rn "new Date(" src/ ' +
      '--include="*.ts" --include="*.tsx" ' +
      '--exclude="*date.ts" --exclude="*.test.ts" --exclude="*.test.tsx" ' +
      '--exclude="*db-init.ts" ' +
      '|| true',
      { encoding: 'utf-8', cwd: '/home/jdoe/case-calendar' }
    )
    // If any matches found, the test fails and the violating lines are shown
    expect(result.trim()).toBe('')
  })
})
