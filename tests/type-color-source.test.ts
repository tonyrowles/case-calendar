import { describe, it, expect } from 'vitest'
// Use tinyglobby (already installed as a transitive dep) — exposes the same
// globSync API as the 'glob' package. Plan 02 uses these to scan src/client.
import { globSync } from 'tinyglobby'
import fs from 'node:fs'

// TYPE-06 grep guard — allow list of hex literals permitted in src/client source.
// Plans 03/04 must not add hex literals to source without adding to this list
// with a code-review justification comment (// allow-hex: <reason>).
const ALLOWED_HEX = new Set([
  '#374151', // gray-700 — FALLBACK_COLOR in useTypeColors.ts
  '#B91C1C', // red-700  — OVERDUE_BORDER_COLOR in EventPill.tsx
].map(h => h.toUpperCase()))
const ALLOW_TAG = /\/\/\s*allow-hex:/

describe('TYPE-06: no hardcoded type-color hex in React source', () => {
  it('src/client/**/*.{ts,tsx} contains no unauthorized hex literals', () => {
    // Scope: client source only (src/server/** excluded — seed.ts is the source of truth)
    // Ignore: *.css files (calendar.css allowed), test files
    const files = globSync('src/client/**/*.{ts,tsx}', {
      ignore: ['**/*.test.*'],
    })
    const offenders: Array<{ file: string; line: number; hex: string }> = []
    for (const file of files) {
      const lines = fs.readFileSync(file, 'utf-8').split('\n')
      lines.forEach((line, i) => {
        // Skip lines with escape hatch comment (// allow-hex: <justification>)
        if (ALLOW_TAG.test(line)) return
        // Match 6-char hex literals only (3-char shorthand not used in this project)
        const matches = line.matchAll(/#[0-9A-Fa-f]{6}/g)
        for (const m of matches) {
          if (!ALLOWED_HEX.has(m[0].toUpperCase())) {
            offenders.push({ file, line: i + 1, hex: m[0] })
          }
        }
      })
    }
    // Second arg surfaces the offenders in the failure message for easy debugging
    expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([])
  })
})

// Expose constants so future plans can reuse without re-declaring.
export { ALLOWED_HEX, ALLOW_TAG, globSync, fs }
