/**
 * NL-02: Anthropic SDK wrapper with dependency-injection seam for testing.
 *
 * parseDeadline(text, typeNames, today) calls the Anthropic Messages API
 * with forced tool_use to guarantee structured JSON output. The DI seam
 * (setAnthropicImpl / __resetAnthropicImpl) allows tests to inject a mock
 * without requiring ANTHROPIC_API_KEY in the test environment.
 *
 * Security notes:
 * - API key is read lazily inside buildRealImpl() (NOT at module import time)
 *   so test imports do not require the env var.
 * - Prompt injection note: tool_choice forcing + strict schema constrains
 *   output shape regardless of user input content.
 * - maxRetries: 0 disables SDK retry amplification (default is 2 retries,
 *   causing 3x API calls on timeout — T-11-01-RUNAWAY mitigation).
 */
import Anthropic from '@anthropic-ai/sdk'
import { logger } from '../logger.js'
import { parseLocalDate } from '../../shared/lib/date.js'

// ─────────────────────────────────────────────────────────────────────────────
// Exported types
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedDeadline {
  caseLabel: string
  typeName: string         // raw LLM output; route resolves to typeId
  date: string             // YYYY-MM-DD (regex-validated)
  description: string | null  // null when LLM returns empty/missing
}

export type AnthropicCreateFn = (
  params: Anthropic.MessageCreateParams
) => Promise<Anthropic.Message>

// ─────────────────────────────────────────────────────────────────────────────
// Typed error classes
// ─────────────────────────────────────────────────────────────────────────────

export class ParserUnconfiguredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParserUnconfiguredError'
  }
}

export class ParserFailedError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParserFailedError'
  }
}

export class ParserTimeoutError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ParserTimeoutError'
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Dependency-injection seam (tests override via setAnthropicImpl)
// ─────────────────────────────────────────────────────────────────────────────

let anthropicImpl: AnthropicCreateFn | null = null

export function setAnthropicImpl(fn: AnthropicCreateFn): void {
  anthropicImpl = fn
}

export function __resetAnthropicImpl(): void {
  anthropicImpl = null
}

// ─────────────────────────────────────────────────────────────────────────────
// Private: tool schema builder
// ─────────────────────────────────────────────────────────────────────────────

function buildTool(typeNames: string[]): Anthropic.Tool {
  return {
    name: 'parse_deadline',
    description: 'Extract a legal deadline from free text.',
    strict: true,  // grammar-constrained sampling — guarantees required fields + correct types
    input_schema: {
      type: 'object' as const,
      properties: {
        caseLabel: {
          type: 'string',
          description: 'Short case name, e.g. "Smith v. Jones"',
        },
        typeName: {
          type: 'string',
          description: 'One of: ' + typeNames.join(', ') + ' — pick the closest match',
        },
        date: {
          type: 'string',
          pattern: '^\\d{4}-\\d{2}-\\d{2}$',  // simple regex, supported in strict mode
          description: 'ISO date YYYY-MM-DD',
        },
        description: {
          type: 'string',
          description: 'Optional brief note; empty string if none',
        },
      },
      required: ['caseLabel', 'typeName', 'date'],
      additionalProperties: false,  // required for strict: true
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Private: real implementation builder (lazy — reads env at call time)
// ─────────────────────────────────────────────────────────────────────────────

function buildRealImpl(): AnthropicCreateFn {
  // T-11-01-AUTH: API key read lazily per-call; never logged; never read at import time.
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY!,
    maxRetries: 0,  // T-11-01-RUNAWAY: disable SDK retry amplification (default=2)
  })
  return (params) => client.messages.create(params, { timeout: 10_000 })
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export: parseDeadline
// ─────────────────────────────────────────────────────────────────────────────

export async function parseDeadline(
  text: string,
  typeNames: string[],
  today: string  // YYYY-MM-DD, from toISODateString(new Date()) in route
): Promise<ParsedDeadline> {
  // Guard: if no mock is injected AND the env var is missing, fail fast before
  // buildRealImpl() tries to construct an Anthropic client with an undefined key.
  if (anthropicImpl === null && !process.env.ANTHROPIC_API_KEY) {
    throw new ParserUnconfiguredError('ANTHROPIC_API_KEY is not set')
  }

  const callFn = anthropicImpl ?? buildRealImpl()

  // System prompt per CONTEXT.md decisions
  const systemPrompt =
    `Today is ${today}. Extract a single legal-deadline record from the user's input. ` +
    'Use a date in the FUTURE unless the user clearly says past. ' +
    'If month/day is ambiguous, prefer US conventions. ' +
    'If no year given, infer the next occurrence (this year if upcoming, next year if past).'

  let response: Anthropic.Message
  try {
    response = await callFn(
      {
        model: 'claude-sonnet-4-6',
        max_tokens: 256,
        system: systemPrompt,
        messages: [{ role: 'user', content: text }],
        tools: [buildTool(typeNames)],
        tool_choice: { type: 'tool', name: 'parse_deadline' },
      },
      { timeout: 10_000 }
    )
  } catch (err: unknown) {
    const anyErr = err as { name?: string; message?: string }
    // T-11-01-RUNAWAY: timeout check — use name-check to avoid importing real SDK error class in tests
    if (anyErr.name === 'APIConnectionTimeoutError') {
      throw new ParserTimeoutError('Anthropic API timed out after 10s')
    }
    logger.error({ err }, 'nl-parser: SDK call failed')
    throw new ParserFailedError(anyErr.message ?? 'Unknown SDK error')
  }

  // Extract tool_use block from response
  const toolBlock = response.content.find((b) => b.type === 'tool_use')
  if (!toolBlock || toolBlock.type !== 'tool_use') {
    throw new ParserFailedError('No tool_use block in response')
  }

  const input = toolBlock.input as {
    caseLabel: string
    typeName: string
    date: string
    description?: string
  }

  // T-11-01-HALLUCINATE: defense-in-depth date validation (SAFE-03)
  // Regex check + parseLocalDate calendar round-trip (catches invalid dates like Feb 30)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || parseLocalDate(input.date) === null) {
    throw new ParserFailedError('Parser returned invalid date format')
  }

  // Coerce empty/missing description to null (T-11-01-LEAK: raw text NOT logged, only inputLength)
  const description = input.description?.trim() || null

  // Log structured success info for cost tracking (T-11-01-LEAK: raw text not logged)
  logger.info(
    {
      inputLength: text.length,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      caseLabel: input.caseLabel,
      typeName: input.typeName,
      date: input.date,
    },
    'nl-parse: success'
  )

  return {
    caseLabel: input.caseLabel,
    typeName: input.typeName,
    date: input.date,
    description,
  }
}
