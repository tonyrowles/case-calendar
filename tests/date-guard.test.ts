/**
 * SAFE-03: Static grep guard — no raw `new Date(string)` outside date util.
 *
 * Pattern matches `new Date("...")` and `new Date('...')` only — bare `new Date()` is
 * allowed everywhere because it returns the current time and carries no off-by-one risk.
 * String-argument forms are the dangerous patterns that cause off-by-one DST bugs.
 *
 * Two separate fixed-string greps are used (one for double-quote form, one for
 * single-quote form) to stay portable across GNU grep and BSD grep without -P (Perl mode).
 *
 * Legitimate exclusions:
 * - src/shared/lib/date.ts — the ONLY place where date strings become Date objects
 * - *.test.ts / *.test.tsx — test files may use new Date() for setup fixtures
 * - src/server/db-init.ts — uses `new Date()` (no arg) for current time in backup/retention
 */
import { execSync } from 'node:child_process'
import { describe, it, expect } from 'vitest'

describe('SAFE-03: no raw new Date(string) calls outside date util', () => {
  it('grep finds no new Date("...") or new Date(\'...\') calls in source files outside permitted locations', () => {
    const doubleQuoteResult = execSync(
      'grep -rn \'new Date("\' src/ ' +
      '--include="*.ts" --include="*.tsx" ' +
      '--exclude="*date.ts" --exclude="*.test.ts" --exclude="*.test.tsx" ' +
      '--exclude="*db-init.ts" ' +
      '|| true',
      { encoding: 'utf-8', cwd: '/home/jdoe/case-calendar' }
    )
    const singleQuoteResult = execSync(
      "grep -rn \"new Date('\" src/ " +
      '--include="*.ts" --include="*.tsx" ' +
      '--exclude="*date.ts" --exclude="*.test.ts" --exclude="*.test.tsx" ' +
      '--exclude="*db-init.ts" ' +
      '|| true',
      { encoding: 'utf-8', cwd: '/home/jdoe/case-calendar' }
    )
    const combined = (doubleQuoteResult + singleQuoteResult).trim()
    // If any matches found, the test fails and the violating lines are shown
    expect(combined).toBe('')
  })
})
