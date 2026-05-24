/**
 * Email digest worker tests — EMAIL-01 + EMAIL-02 coverage.
 *
 * Mock structure mirrors wallpaper.test.ts exactly:
 * - nodemailer, dotenv, node-cron, queries, logger all vi.mock'd at top
 * - Module-level state reset via em.__resetForTests() in beforeEach
 * - vi.stubEnv / vi.unstubAllEnvs for per-test env mutation
 *
 * Test groups:
 * - EMAIL-02: graceful degradation when disabled or misconfigured
 * - EMAIL-01: happy path — cron scheduling with correct args
 * - EMAIL-01: sendDigest queries DB, joins types, calls sendMail via DI seam
 * - EMAIL-02: cron callback failure handling (sendMail rejection → warn, no crash)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// vi.mock blocks are hoisted to the top of the file by Vitest regardless of placement.
// Placing them visually first matches the project convention (see wallpaper.test.ts).

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({
      verify: vi.fn().mockResolvedValue(true),
      sendMail: vi.fn().mockResolvedValue({ messageId: 'test-msg-id' }),
    })),
  },
}))

vi.mock('dotenv', () => ({
  default: { config: vi.fn() },
}))

vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn().mockReturnValue({ stop: vi.fn(), destroy: vi.fn() }),
  },
}))

vi.mock('../queries.js', () => ({
  getAllDeadlines: vi.fn().mockReturnValue([]),
  getAllDeadlineTypes: vi.fn().mockReturnValue([]),
}))

vi.mock('../logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import * as em from './email.js'
import cron from 'node-cron'
import nodemailer from 'nodemailer'
import { logger } from '../logger.js'
import { getAllDeadlines, getAllDeadlineTypes } from '../queries.js'

// ─────────────────────────────────────────────────────────────────────────────
// Test helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stub all six required SMTP vars + EMAIL_DIGEST_ENABLED to valid test values.
 * Call at the start of any test that should reach the happy path.
 */
function setEnv(): void {
  vi.stubEnv('EMAIL_DIGEST_ENABLED', 'true')
  vi.stubEnv('SMTP_HOST', 'smtp.example.com')
  vi.stubEnv('SMTP_PORT', '587')
  vi.stubEnv('SMTP_USER', 'user@example.com')
  vi.stubEnv('SMTP_PASS', 'testpassword')
  vi.stubEnv('SMTP_FROM', 'from@example.com')
  vi.stubEnv('SMTP_TO', 'to@example.com')
}

// ─────────────────────────────────────────────────────────────────────────────
// Test lifecycle
// ─────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  // Reset module-level state: cronTask, transporter, sendMailImpl
  em.__resetForTests()
  vi.clearAllMocks()

  // Re-establish default mock return values after clearAllMocks resets them
  ;(cron.schedule as ReturnType<typeof vi.fn>).mockReturnValue({ stop: vi.fn(), destroy: vi.fn() })
  ;(nodemailer.createTransport as ReturnType<typeof vi.fn>).mockReturnValue({
    verify: vi.fn().mockResolvedValue(true),
    sendMail: vi.fn().mockResolvedValue({ messageId: 'test-msg-id' }),
  })
  ;(getAllDeadlines as ReturnType<typeof vi.fn>).mockReturnValue([])
  ;(getAllDeadlineTypes as ReturnType<typeof vi.fn>).mockReturnValue([])
})

afterEach(() => {
  // Restore all process.env stubs set via vi.stubEnv
  vi.unstubAllEnvs()
})

// ─────────────────────────────────────────────────────────────────────────────
// Graceful degradation tests (EMAIL-02)
// ─────────────────────────────────────────────────────────────────────────────

describe('startEmailWorker — graceful degradation (EMAIL-02)', () => {
  it('10-02-01: EMAIL_DIGEST_ENABLED unset → no-op (no cron, no transport)', async () => {
    // Leave EMAIL_DIGEST_ENABLED unset (not 'true')
    vi.stubEnv('EMAIL_DIGEST_ENABLED', '')

    await em.startEmailWorker()

    expect(cron.schedule).not.toHaveBeenCalled()
    expect(nodemailer.createTransport).not.toHaveBeenCalled()
    // logger.info called with the disabled message
    const infoCalls = (logger.info as ReturnType<typeof vi.fn>).mock.calls
    const hasDisabledMsg = infoCalls.some((args) =>
      typeof args[0] === 'string' && args[0].includes('email digest disabled')
    )
    expect(hasDisabledMsg).toBe(true)
  })

  it('10-02-01 variant: missing SMTP_HOST → no-op with missing array in log payload', async () => {
    // Set enabled but omit SMTP_HOST
    vi.stubEnv('EMAIL_DIGEST_ENABLED', 'true')
    vi.stubEnv('SMTP_PORT', '587')
    vi.stubEnv('SMTP_USER', 'user@example.com')
    vi.stubEnv('SMTP_PASS', 'testpassword')
    vi.stubEnv('SMTP_FROM', 'from@example.com')
    vi.stubEnv('SMTP_TO', 'to@example.com')
    // SMTP_HOST intentionally not stubbed

    await em.startEmailWorker()

    expect(cron.schedule).not.toHaveBeenCalled()

    // logger.info must have been called with a payload containing 'missing' array
    const infoCalls = (logger.info as ReturnType<typeof vi.fn>).mock.calls
    const missingCall = infoCalls.find((args) => {
      const payload = args[0]
      return (
        typeof payload === 'object' &&
        payload !== null &&
        Array.isArray(payload.missing) &&
        (payload.missing as string[]).includes('SMTP_HOST')
      )
    })
    expect(missingCall).toBeDefined()
  })

  it('10-02-02: verify() rejection → warn logged, no cron scheduled, no crash', async () => {
    setEnv()

    // Override createTransport mock to return a transporter with a rejecting verify
    const verifyError = new Error('auth failure')
    ;(nodemailer.createTransport as ReturnType<typeof vi.fn>).mockReturnValue({
      verify: vi.fn().mockRejectedValue(verifyError),
      sendMail: vi.fn(),
    })

    // Must NOT throw — promise resolves (server stays up)
    await expect(em.startEmailWorker()).resolves.toBeUndefined()

    expect(cron.schedule).not.toHaveBeenCalled()

    // logger.warn must have been called with the err
    expect(logger.warn).toHaveBeenCalled()
    const warnCalls = (logger.warn as ReturnType<typeof vi.fn>).mock.calls
    const hasErrWarn = warnCalls.some((args) => {
      const payload = args[0]
      return typeof payload === 'object' && payload !== null && payload.err === verifyError
    })
    expect(hasErrWarn).toBe(true)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Happy path — cron scheduling (EMAIL-01)
// ─────────────────────────────────────────────────────────────────────────────

describe('startEmailWorker — happy path scheduling (EMAIL-01)', () => {
  it('10-02-03: cron.schedule called with correct expression and options', async () => {
    setEnv()

    await em.startEmailWorker()

    expect(cron.schedule).toHaveBeenCalledTimes(1)

    const call = (cron.schedule as ReturnType<typeof vi.fn>).mock.calls[0]

    // First arg: 5-field POSIX cron expression (Pitfall 4: NOT 6-field)
    expect(call[0]).toBe('0 7 * * *')

    // Second arg: callback function
    expect(typeof call[1]).toBe('function')

    // Third arg: options object with required fields
    const opts = call[2] as { timezone?: string; noOverlap?: boolean; name?: string }
    expect(opts.noOverlap).toBe(true)
    expect(opts.name).toBe('email-digest-cron')
    expect(typeof opts.timezone).toBe('string')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// sendDigest pipeline (EMAIL-01)
// ─────────────────────────────────────────────────────────────────────────────

describe('sendDigest (EMAIL-01)', () => {
  it('10-02-04: queries DB, joins types, calls sendMail with correct shape', async () => {
    setEnv()

    // Set up queries to return one deadline with a matching type
    ;(getAllDeadlines as ReturnType<typeof vi.fn>).mockReturnValue([
      {
        id: 1,
        date: '2030-01-01',
        caseLabel: 'Test v. Case',
        typeId: 1,
        description: null,
        completedAt: null,
        createdAt: '',
        updatedAt: '',
      },
    ])
    ;(getAllDeadlineTypes as ReturnType<typeof vi.fn>).mockReturnValue([
      { id: 1, name: 'Filing', color: '#1D4ED8' },
    ])

    // Install a spy via DI seam
    const spy = vi.fn().mockResolvedValue({ messageId: 'x' })
    em.setSendMailImpl(spy)

    await em.sendDigest()

    expect(spy).toHaveBeenCalledTimes(1)

    const opts = spy.mock.calls[0][0] as {
      from: string
      to: string
      subject: string
      text: string
      html: string
    }
    expect(opts.from).toBeTruthy()
    expect(opts.to).toBeTruthy()
    expect(opts.subject).toContain('Case Calendar digest')
    expect(typeof opts.text).toBe('string')
    expect(typeof opts.html).toBe('string')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Cron callback failure handling (EMAIL-02)
// ─────────────────────────────────────────────────────────────────────────────

describe('cron callback failure handling (EMAIL-02)', () => {
  it('10-02-05: sendMail rejection in cron callback → logger.warn, no crash', async () => {
    setEnv()

    await em.startEmailWorker()

    // Retrieve the captured cron callback (second arg to cron.schedule)
    const cb = (cron.schedule as ReturnType<typeof vi.fn>).mock.calls[0][1] as () => Promise<void>

    // Make sendMail reject via DI seam
    em.setSendMailImpl(vi.fn().mockRejectedValue(new Error('SMTP server unreachable')))

    // Invoking the callback must NOT throw (worker stays scheduled)
    await expect(cb()).resolves.toBeUndefined()

    // logger.warn must have been called with the error
    expect(logger.warn).toHaveBeenCalled()
  })
})
