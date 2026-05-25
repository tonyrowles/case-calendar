/**
 * Unit tests for nl-parser.ts — Anthropic SDK wrapper with DI seam.
 *
 * Strategy: The DI seam (setAnthropicImpl) means the real SDK is never
 * instantiated when a mock is injected. Tests do NOT vi.mock @anthropic-ai/sdk
 * at the module level — they inject mock functions via setAnthropicImpl.
 *
 * Covers: NL-02
 */
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  parseDeadline,
  setAnthropicImpl,
  __resetAnthropicImpl,
  ParserUnconfiguredError,
  ParserFailedError,
  ParserTimeoutError,
} from './nl-parser.js'
import type { ParsedDeadline } from './nl-parser.js'

// Mock logger — nl-parser imports from ../logger.js
vi.mock('../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// ─────────────────────────────────────────────────────────────────────────────
// Test fixture — success response from Anthropic
// ─────────────────────────────────────────────────────────────────────────────

const happyResponse = {
  stop_reason: 'tool_use',
  content: [
    {
      type: 'tool_use',
      name: 'parse_deadline',
      input: {
        caseLabel: 'Smith v. Jones',
        typeName: 'Deposition',
        date: '2026-06-15',
        description: 'Expert witness deposition at 10am',
      },
    },
  ],
  usage: { input_tokens: 450, output_tokens: 80 },
}

const typeNames = ['Filing', 'Hearing', 'Deposition', 'Other']
const today = '2026-05-24'

// ─────────────────────────────────────────────────────────────────────────────
// Setup/teardown
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  __resetAnthropicImpl()
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('parseDeadline — SDK call shape', () => {
  it('11-01-01: calls injected impl with model, tool_choice, system prompt, and per-request timeout', async () => {
    const mockCreate = vi.fn().mockResolvedValue(happyResponse)
    setAnthropicImpl(mockCreate)

    await parseDeadline('Smith deposition June 15', typeNames, today)

    expect(mockCreate).toHaveBeenCalledOnce()
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-4-6',
        tool_choice: { type: 'tool', name: 'parse_deadline' },
        system: expect.stringContaining(today),
      }),
      { timeout: 10_000 }
    )
  })

  it('11-01-02: forwards user text as messages[0].content with role "user"', async () => {
    const mockCreate = vi.fn().mockResolvedValue(happyResponse)
    setAnthropicImpl(mockCreate)

    const text = 'Smith deposition June 15'
    await parseDeadline(text, typeNames, today)

    const [params] = mockCreate.mock.calls[0]
    expect(params.messages).toEqual([{ role: 'user', content: text }])
  })

  it('11-01-03: typeNames are included in the tool input_schema typeName description', async () => {
    const mockCreate = vi.fn().mockResolvedValue(happyResponse)
    setAnthropicImpl(mockCreate)

    const customTypes = ['Appeal', 'Trial', 'Other']
    await parseDeadline('some text', customTypes, today)

    const [params] = mockCreate.mock.calls[0]
    const tool = params.tools[0]
    const typeNameProp = tool.input_schema.properties.typeName
    expect(typeNameProp.description).toContain('Appeal')
    expect(typeNameProp.description).toContain('Trial')
    expect(typeNameProp.description).toContain('Other')
  })

  it('11-01-04: tool definition has strict:true AND input_schema.additionalProperties:false', async () => {
    const mockCreate = vi.fn().mockResolvedValue(happyResponse)
    setAnthropicImpl(mockCreate)

    await parseDeadline('some text', typeNames, today)

    const [params] = mockCreate.mock.calls[0]
    const tool = params.tools[0]
    expect(tool.strict).toBe(true)
    expect(tool.input_schema.additionalProperties).toBe(false)
  })

  it("11-01-05: tool input_schema.properties.date.pattern equals '^\\\\d{4}-\\\\d{2}-\\\\d{2}$'", async () => {
    const mockCreate = vi.fn().mockResolvedValue(happyResponse)
    setAnthropicImpl(mockCreate)

    await parseDeadline('some text', typeNames, today)

    const [params] = mockCreate.mock.calls[0]
    const tool = params.tools[0]
    expect(tool.input_schema.properties.date.pattern).toBe('^\\d{4}-\\d{2}-\\d{2}$')
  })
})

describe('parseDeadline — return value', () => {
  it('11-01-06: returns ParsedDeadline from tool_use block; empty description coerced to null', async () => {
    const responseWithEmptyDesc = {
      ...happyResponse,
      content: [
        {
          type: 'tool_use',
          name: 'parse_deadline',
          input: {
            caseLabel: 'Smith v. Jones',
            typeName: 'Deposition',
            date: '2026-06-15',
            description: '',
          },
        },
      ],
    }
    const mockCreate = vi.fn().mockResolvedValue(responseWithEmptyDesc)
    setAnthropicImpl(mockCreate)

    const result: ParsedDeadline = await parseDeadline('some text', typeNames, today)

    expect(result.caseLabel).toBe('Smith v. Jones')
    expect(result.typeName).toBe('Deposition')
    expect(result.date).toBe('2026-06-15')
    expect(result.description).toBeNull()
  })
})

describe('parseDeadline — error paths', () => {
  it('11-01-07: throws ParserFailedError when response.content has no tool_use block', async () => {
    const noToolResponse = {
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'I cannot parse that.' }],
      usage: { input_tokens: 100, output_tokens: 20 },
    }
    const mockCreate = vi.fn().mockResolvedValue(noToolResponse)
    setAnthropicImpl(mockCreate)

    await expect(parseDeadline('some text', typeNames, today)).rejects.toThrow(ParserFailedError)
  })

  it('11-01-08: throws ParserFailedError when returned date does not match /^\\d{4}-\\d{2}-\\d{2}$/', async () => {
    const badDateResponse = {
      stop_reason: 'tool_use',
      content: [
        {
          type: 'tool_use',
          name: 'parse_deadline',
          input: {
            caseLabel: 'Smith v. Jones',
            typeName: 'Deposition',
            date: 'June 15',
            description: '',
          },
        },
      ],
      usage: { input_tokens: 100, output_tokens: 20 },
    }
    const mockCreate = vi.fn().mockResolvedValue(badDateResponse)
    setAnthropicImpl(mockCreate)

    await expect(parseDeadline('some text', typeNames, today)).rejects.toThrow(ParserFailedError)
  })

  it('11-01-09: throws ParserTimeoutError when impl throws error with name===APIConnectionTimeoutError', async () => {
    class MockTimeoutError extends Error {
      constructor() {
        super('Request timed out')
        this.name = 'APIConnectionTimeoutError'
      }
    }
    const mockCreate = vi.fn().mockRejectedValue(new MockTimeoutError())
    setAnthropicImpl(mockCreate)

    await expect(parseDeadline('some text', typeNames, today)).rejects.toThrow(ParserTimeoutError)
  })

  it('11-01-10: throws ParserUnconfiguredError when no impl injected AND ANTHROPIC_API_KEY is empty', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '')
    __resetAnthropicImpl()

    await expect(parseDeadline('some text', typeNames, today)).rejects.toThrow(
      ParserUnconfiguredError
    )
  })

  it('11-01-11: after __resetAnthropicImpl, next call with missing API key throws ParserUnconfiguredError', async () => {
    // First set a valid mock
    const mockCreate = vi.fn().mockResolvedValue(happyResponse)
    setAnthropicImpl(mockCreate)

    // Reset clears the injection
    __resetAnthropicImpl()
    vi.stubEnv('ANTHROPIC_API_KEY', '')

    // Now the call should fail with unconfigured error
    await expect(parseDeadline('some text', typeNames, today)).rejects.toThrow(
      ParserUnconfiguredError
    )
  })
})

describe('parseDeadline — logging', () => {
  it('11-01-12: logs structured info on success with inputLength, inputTokens, outputTokens, caseLabel, typeName, date', async () => {
    const { logger } = await import('../logger.js')
    const mockCreate = vi.fn().mockResolvedValue(happyResponse)
    setAnthropicImpl(mockCreate)

    const text = 'Smith deposition June 15'
    await parseDeadline(text, typeNames, today)

    expect(logger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        inputLength: text.length,
        inputTokens: 450,
        outputTokens: 80,
        caseLabel: 'Smith v. Jones',
        typeName: 'Deposition',
        date: '2026-06-15',
      }),
      expect.any(String)
    )
  })
})
