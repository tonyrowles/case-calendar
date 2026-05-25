/**
 * SAFE-03: Static guard — no raw `new Date(string)` outside date util.
 *
 * Pattern matches `new Date("...")` and `new Date('...')` only — bare `new Date()` is
 * allowed everywhere because it returns the current time and carries no off-by-one risk.
 * String-argument forms are the dangerous patterns that cause off-by-one DST bugs.
 *
 * Cross-platform: uses Node fs to walk the tree instead of shelling out to grep
 * (avoids ENOENT on Windows where grep is not available).
 *
 * Legitimate exclusions:
 * - src/shared/lib/date.ts — the ONLY place where date strings become Date objects
 * - *.test.ts / *.test.tsx — test files may use new Date() for setup fixtures
 * - src/server/db-init.ts — uses `new Date()` (no arg) for current time in backup/retention
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'

const PROJECT_ROOT = path.resolve(__dirname, '..')
const SRC_DIR = path.join(PROJECT_ROOT, 'src')

function shouldExclude(absPath: string): boolean {
  const rel = path.relative(PROJECT_ROOT, absPath).split(path.sep).join('/')
  if (rel.endsWith('.test.ts') || rel.endsWith('.test.tsx')) return true
  if (rel === 'src/shared/lib/date.ts') return true
  if (rel === 'src/server/db-init.ts') return true
  return false
}

function walkFiles(dir: string, acc: string[]): void {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      walkFiles(full, acc)
    } else if (st.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx'))) {
      if (!shouldExclude(full)) acc.push(full)
    }
  }
}

describe('SAFE-03: no raw new Date(string) calls outside date util', () => {
  it('static scan finds no new Date("...") or new Date(\'...\') calls in source files outside permitted locations', () => {
    const files: string[] = []
    walkFiles(SRC_DIR, files)

    const violations: string[] = []
    // Match new Date("...) or new Date('...) — string literal in first arg.
    const pattern = /new Date\(["']/

    for (const file of files) {
      const content = readFileSync(file, 'utf-8')
      const lines = content.split(/\r?\n/)
      lines.forEach((line, idx) => {
        if (pattern.test(line)) {
          const rel = path.relative(PROJECT_ROOT, file).split(path.sep).join('/')
          violations.push(`${rel}:${idx + 1}: ${line.trim()}`)
        }
      })
    }

    // If any matches found, the test fails and the violating lines are shown
    expect(violations).toEqual([])
  })
})
