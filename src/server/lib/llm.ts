/**
 * Which LLM provider powers quick-add, Import and Email Import, plus the OpenAI call.
 *
 *   LLM_PROVIDER=openai | anthropic   explicit choice (optional)
 *   otherwise: OpenAI when OPENAI_API_KEY is set, else Anthropic (ANTHROPIC_API_KEY)
 *   OPENAI_MODEL                       default gpt-5.6
 *
 * OpenAI requests use the Responses API with structured outputs (responses.parse +
 * zodTextFormat) and store: false, so request/response content is not kept as a stored
 * response on OpenAI's side. Raw input text is never logged here.
 */
import OpenAI from 'openai'
import { zodTextFormat } from 'openai/helpers/zod'
import type { z } from 'zod'
import { logger } from '../logger.js'

export type LlmProvider = 'openai' | 'anthropic'

export const DEFAULT_OPENAI_MODEL = 'gpt-5.6'

export function llmProvider(env: NodeJS.ProcessEnv = process.env): LlmProvider {
  const explicit = env.LLM_PROVIDER?.trim().toLowerCase()
  if (explicit === 'openai' || explicit === 'anthropic') return explicit
  return env.OPENAI_API_KEY ? 'openai' : 'anthropic'
}

/** True when the selected provider has its API key. */
export function llmConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return llmProvider(env) === 'openai' ? !!env.OPENAI_API_KEY : !!env.ANTHROPIC_API_KEY
}

export const LLM_UNCONFIGURED_MESSAGE =
  'Add an OpenAI or Anthropic API key in Settings > Setup to enable reading deadlines from text.'

export function openaiModel(env: NodeJS.ProcessEnv = process.env): string {
  return env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL
}

/** A failed/declined/truncated model call, with a message fit to show the user. */
export class LlmCallError extends Error {
  name = 'LlmCallError'
  constructor(message: string, readonly kind: 'refusal' | 'truncated' | 'timeout' | 'failed') {
    super(message)
  }
}

// The subset of a parsed Responses API result this module reads (keeps the test seam simple).
export interface OpenAIParsedResult<T> {
  status?: string | null
  incomplete_details?: { reason?: string | null } | null
  output_parsed: T | null
  output: Array<{ type: string; content?: Array<{ type: string; refusal?: string }> }>
  usage?: { input_tokens?: number; output_tokens?: number; output_tokens_details?: { reasoning_tokens?: number } } | null
}

export interface OpenAIParseRequest {
  model: string
  instructions: string
  input: string
  schema: z.ZodType
  schemaName: string
  effort: 'low' | 'medium' | 'high'
  maxOutputTokens: number
  timeoutMs: number
}

export type OpenAIParseFn = (req: OpenAIParseRequest) => Promise<OpenAIParsedResult<unknown>>

const realOpenAIParse: OpenAIParseFn = async (req) => {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY!, maxRetries: 1 })
  return await client.responses.parse(
    {
      model: req.model,
      instructions: req.instructions,
      input: req.input,
      reasoning: { effort: req.effort },
      max_output_tokens: req.maxOutputTokens,
      store: false,
      text: { format: zodTextFormat(req.schema, req.schemaName) },
    },
    { timeout: req.timeoutMs }
  ) as unknown as OpenAIParsedResult<unknown>
}

let openaiParseImpl: OpenAIParseFn = realOpenAIParse
export function __setOpenAIParse(fn: OpenAIParseFn): void { openaiParseImpl = fn }
export function __resetOpenAIParse(): void { openaiParseImpl = realOpenAIParse }

/**
 * Call OpenAI with a zod schema and return the parsed object, or throw LlmCallError for
 * refusals, truncation, content filtering, timeouts and other failures.
 */
export async function openaiParse<T>(req: Omit<OpenAIParseRequest, 'schema'> & { schema: z.ZodType<T> }, logLabel: string): Promise<T> {
  let res: OpenAIParsedResult<unknown>
  try {
    res = await openaiParseImpl(req)
  } catch (err) {
    if (err instanceof OpenAI.APIConnectionTimeoutError) {
      throw new LlmCallError('The request timed out. Try again, or use a shorter text.', 'timeout')
    }
    if (err instanceof OpenAI.APIError) {
      logger.error({ status: err.status, code: err.code }, `${logLabel}: OpenAI API error`)
      throw new LlmCallError(`OpenAI API error${err.status ? ` (${err.status})` : ''}: ${err.message}`, 'failed')
    }
    logger.error({ err }, `${logLabel}: OpenAI call failed`)
    throw new LlmCallError(err instanceof Error ? err.message : 'The model call failed.', 'failed')
  }

  const refusal = res.output
    .flatMap(item => (item.type === 'message' ? item.content ?? [] : []))
    .find(c => c.type === 'refusal')
  if (refusal) throw new LlmCallError('The model declined to process this text.', 'refusal')
  if (res.status === 'incomplete') {
    const reason = res.incomplete_details?.reason
    throw new LlmCallError(
      reason === 'max_output_tokens'
        ? 'The text produced too much output to process at once. Try a shorter excerpt.'
        : 'The response was cut off (content filter). Try a different excerpt.',
      'truncated'
    )
  }
  if (res.output_parsed === null || res.output_parsed === undefined) {
    throw new LlmCallError('The model returned no usable result.', 'failed')
  }
  logger.info(
    {
      model: req.model,
      inputLength: req.input.length,
      inputTokens: res.usage?.input_tokens,
      outputTokens: res.usage?.output_tokens,
      reasoningTokens: res.usage?.output_tokens_details?.reasoning_tokens,
    },
    `${logLabel}: OpenAI success`
  )
  return res.output_parsed as T
}
