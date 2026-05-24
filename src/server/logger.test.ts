import { describe, it, expect } from 'vitest'
import { buildLoggerOptions } from './logger.js'

describe('logger NODE_ENV switch (OPS-02 production-mode quality)', () => {
  it('production env yields transport: undefined (JSON to stdout for NSSM)', () => {
    const opts = buildLoggerOptions({ NODE_ENV: 'production' } as NodeJS.ProcessEnv)
    expect(opts.transport).toBeUndefined()
    expect(opts.level).toBe('info')
  })

  it('production env honors LOG_LEVEL override', () => {
    const opts = buildLoggerOptions({ NODE_ENV: 'production', LOG_LEVEL: 'warn' } as NodeJS.ProcessEnv)
    expect(opts.transport).toBeUndefined()
    expect(opts.level).toBe('warn')
  })

  it('undefined NODE_ENV yields pino-pretty transport (dev terminal readability)', () => {
    const opts = buildLoggerOptions({} as NodeJS.ProcessEnv)
    expect(opts.transport).toEqual({ target: 'pino-pretty' })
    expect(opts.level).toBe('info')
  })

  it('test NODE_ENV yields pino-pretty transport (vitest console readability)', () => {
    const opts = buildLoggerOptions({ NODE_ENV: 'test' } as NodeJS.ProcessEnv)
    expect(opts.transport).toEqual({ target: 'pino-pretty' })
  })

  it('development NODE_ENV yields pino-pretty transport', () => {
    const opts = buildLoggerOptions({ NODE_ENV: 'development' } as NodeJS.ProcessEnv)
    expect(opts.transport).toEqual({ target: 'pino-pretty' })
  })

  it('dev NODE_ENV honors LOG_LEVEL=debug override', () => {
    const opts = buildLoggerOptions({ NODE_ENV: 'development', LOG_LEVEL: 'debug' } as NodeJS.ProcessEnv)
    expect(opts.level).toBe('debug')
  })
})
