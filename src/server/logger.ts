import pino, { type LoggerOptions } from 'pino'

/**
 * Build pino options based on environment. Exported for testability — the
 * runtime `logger` instance is the result of `pino(buildLoggerOptions(process.env))`.
 *
 * Production (NODE_ENV='production'):
 *   - No transport → pino writes JSON lines to process.stdout.
 *   - This is what NSSM's AppStdout redirect captures into logs/case-calendar.log.
 *   - pino-pretty's ANSI color codes would corrupt that log file, so we disable it.
 *
 * Dev / test (anything else):
 *   - transport: { target: 'pino-pretty' } so terminal output stays readable.
 */
export function buildLoggerOptions(env: NodeJS.ProcessEnv): LoggerOptions {
  const isProd = env.NODE_ENV === 'production'
  return {
    level: env.LOG_LEVEL ?? 'info',
    transport: isProd ? undefined : { target: 'pino-pretty' },
  }
}

export const logger = pino(buildLoggerOptions(process.env))
