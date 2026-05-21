import { type Context } from 'hono'
import { logger } from '../logger.js'

/**
 * SAFE-06: Global error handler factory.
 * Catches uncaught route exceptions and returns the structured error shape.
 * NEVER includes err.stack or err.message in the response body — those go to server logs only.
 * Client receives a fixed human-friendly message with a short code string.
 */
export function createErrorHandler() {
  return (err: Error, c: Context) => {
    // Log full details server-side only (SAFE-06 + V7 ASVS L1)
    logger.error({ err: err.message, stack: err.stack }, 'unhandled route error')
    return c.json(
      { error: { code: 'internal_error', message: 'An unexpected error occurred. Please try again.' } },
      500
    )
  }
}
