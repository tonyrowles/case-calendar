import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// vi.mock MUST appear before app/module imports so the mock is in place
// when index.ts loads deadlines.ts and deadlines.ts loads nl-parser.ts
vi.mock('../lib/nl-parser.js', () => ({
  parseDeadline: vi.fn(),
  ParserUnconfiguredError: class ParserUnconfiguredError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'ParserUnconfiguredError'
    }
  },
  ParserFailedError: class ParserFailedError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'ParserFailedError'
    }
  },
  ParserTimeoutError: class ParserTimeoutError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'ParserTimeoutError'
    }
  },
}))

import { app } from '../index.js'
import { sqlite } from '../db.js'
import * as nlParser from '../lib/nl-parser.js'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cleanTables(): void {
  sqlite.exec('DELETE FROM deadlines')
  sqlite.exec('DELETE FROM deadline_types')
}

function seedTypes(): void {
  const stmt = sqlite.prepare(
    'INSERT OR IGNORE INTO deadline_types (id, name, color) VALUES (?, ?, ?)'
  )
  stmt.run(1, 'Filing', '#1D4ED8')    // allow-hex: test fixture
  stmt.run(2, 'Deposition', '#FB923C') // allow-hex: test fixture
  stmt.run(9, 'Other', '#6b7280')      // allow-hex: test fixture
}

type ParseDeadlineMock = ReturnType<typeof vi.fn>

function mockParsed(overrides: Partial<{
  caseLabel: string
  typeName: string
  date: string
  description: string | null
}> = {}) {
  return {
    caseLabel: 'Smith v. Jones',
    typeName: 'Deposition',
    date: '2026-06-15',
    description: '10am',
    ...overrides,
  }
}

function postParse(body: unknown) {
  return app.request('/api/deadlines/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

// ─── Setup / Teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  cleanTables()
  seedTypes()
  vi.clearAllMocks()
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ─── Test suite ──────────────────────────────────────────────────────────────

describe('NL-02: POST /api/deadlines/parse', () => {
  // 11-02-01: happy path — Deposition type resolves to id 2
  it('11-02-01: 200 happy path — returns parsed result with typeId resolved', async () => {
    ;(nlParser.parseDeadline as ParseDeadlineMock).mockResolvedValue(
      mockParsed({ caseLabel: 'Smith v. Jones', typeName: 'Deposition', date: '2026-06-15', description: '10am' })
    )
    const res = await postParse({ text: 'Smith deposition June 15' })
    expect(res.status).toBe(200)
    const body = await res.json() as {
      caseLabel: string
      typeId: number
      date: string
      description: string | null
    }
    expect(body.caseLabel).toBe('Smith v. Jones')
    expect(body.typeId).toBe(2)  // Deposition's seeded id
    expect(body.date).toBe('2026-06-15')
    expect(body.description).toBe('10am')
  })

  // 11-02-02: null description passes through as null (not undefined, not '')
  it('11-02-02: 200 + null description — description is null in response', async () => {
    ;(nlParser.parseDeadline as ParseDeadlineMock).mockResolvedValue(
      mockParsed({ description: null })
    )
    const res = await postParse({ text: 'Smith deposition June 15' })
    expect(res.status).toBe(200)
    const body = await res.json() as { description: null }
    expect(body.description).toBeNull()
  })

  // 11-02-03: typeName case-insensitive match — 'deposition' (lowercase) → id 2
  it('11-02-03: 200 + typeName case-insensitive match', async () => {
    ;(nlParser.parseDeadline as ParseDeadlineMock).mockResolvedValue(
      mockParsed({ typeName: 'deposition' })
    )
    const res = await postParse({ text: 'Smith deposition June 15' })
    expect(res.status).toBe(200)
    const body = await res.json() as { typeId: number }
    expect(body.typeId).toBe(2)  // same Deposition id
  })

  // 11-02-04: unknown typeName → falls back to Other (id 9)
  it('11-02-04: 200 + Other fallback for unknown typeName', async () => {
    ;(nlParser.parseDeadline as ParseDeadlineMock).mockResolvedValue(
      mockParsed({ typeName: 'Motion' })
    )
    const res = await postParse({ text: 'Smith motion June 15' })
    expect(res.status).toBe(200)
    const body = await res.json() as { typeId: number }
    expect(body.typeId).toBe(9)  // Other's seeded id
  })

  // 11-02-05: date passes regex but parseLocalDate returns null → 422 parse_failed
  it('11-02-05: 422 parse_failed — parseDeadline returns invalid date (regex-valid but calendar-invalid)', async () => {
    ;(nlParser.parseDeadline as ParseDeadlineMock).mockResolvedValue(
      mockParsed({ date: '2026-13-99' })
    )
    const res = await postParse({ text: 'Smith filing something' })
    expect(res.status).toBe(422)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('parse_failed')
  })

  // 11-02-06: parseDeadline throws ParserFailedError → 422 parse_failed
  it('11-02-06: 422 parse_failed — parseDeadline throws ParserFailedError', async () => {
    ;(nlParser.parseDeadline as ParseDeadlineMock).mockRejectedValue(
      new nlParser.ParserFailedError('bad output')
    )
    const res = await postParse({ text: 'Something unparseable' })
    expect(res.status).toBe(422)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('parse_failed')
  })

  // 11-02-07: parseDeadline throws ParserTimeoutError → 504 parser_timeout
  it('11-02-07: 504 parser_timeout — parseDeadline throws ParserTimeoutError', async () => {
    ;(nlParser.parseDeadline as ParseDeadlineMock).mockRejectedValue(
      new nlParser.ParserTimeoutError('timed out')
    )
    const res = await postParse({ text: 'Smith deposition June 15' })
    expect(res.status).toBe(504)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('parser_timeout')
  })

  // 11-02-08: ANTHROPIC_API_KEY unset → 503 parser_unconfigured; parseDeadline NOT called
  it('11-02-08: 503 parser_unconfigured — parseDeadline not called when API key is unset', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')  // override the beforeEach stub
    const res = await postParse({ text: 'Smith deposition June 15' })
    expect(res.status).toBe(503)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('parser_unconfigured')
    // Critical: parseDeadline must NOT be called in this path
    expect((nlParser.parseDeadline as ParseDeadlineMock).mock.calls.length).toBe(0)
  })

  // 11-02-09: missing text field → 422 validation_failed
  it('11-02-09: 422 validation_failed — body has no text field', async () => {
    const res = await postParse({})
    expect(res.status).toBe(422)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('validation_failed')
  })

  // 11-02-10: text is empty string → 422 validation_failed
  it('11-02-10: 422 validation_failed — text is empty string', async () => {
    const res = await postParse({ text: '' })
    expect(res.status).toBe(422)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('validation_failed')
  })

  // 11-02-11: text exceeds 500 chars → 422 validation_failed
  it('11-02-11: 422 validation_failed — text exceeds 500 chars', async () => {
    const res = await postParse({ text: 'a'.repeat(501) })
    expect(res.status).toBe(422)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('validation_failed')
  })

  // 11-02-12: text is not a string → 422 validation_failed
  it('11-02-12: 422 validation_failed — text is not a string', async () => {
    const res = await postParse({ text: 123 })
    expect(res.status).toBe(422)
    const body = await res.json() as { error: { code: string } }
    expect(body.error.code).toBe('validation_failed')
  })
})
