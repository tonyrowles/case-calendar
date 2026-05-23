import { describe, it } from 'vitest'
// Use tinyglobby (already installed as a transitive dep) — exposes the same
// globSync API as the 'glob' package. Plan 02 uses these to scan src/client.
import { globSync } from 'tinyglobby'
import fs from 'node:fs'

// TYPE-06 grep guard — allow list of hex literals permitted in src/client source.
// Plans 03/04 must not add hex literals to source without adding to this list
// with a code-review justification comment (// allow-hex: <reason>).
const ALLOWED_HEX = new Set([
  '#374151', // allow-hex: test fixture — gray fallback in useTypeColors.ts
  '#B91C1C', // allow-hex: test fixture — overdue border in EventPill.tsx
])
const ALLOW_TAG = /\/\/\s*allow-hex:/

describe('TYPE-06: no hardcoded type-color hex in React source', () => {
  it.todo('src/client/**/*.{ts,tsx} contains no unauthorized hex literals')
})

// Expose constants so Plan 02 can flip it.todo → it(...) without re-declaring.
export { ALLOWED_HEX, ALLOW_TAG, globSync, fs }
