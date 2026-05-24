/**
 * EMAIL-01 + EMAIL-02: Email digest worker — nodemailer SMTP transport,
 * node-cron daily 7:00 AM schedule, dotenv .env.local config loading,
 * graceful no-op when unconfigured, and DI seam for unit testing.
 *
 * Covers: EMAIL-01 (daily 7am digest), EMAIL-02 (env-only SMTP config).
 * Plan 03 layers the deployment runbook on top.
 *
 * Mirrors Phase 9 wallpaper worker pattern exactly:
 * - DI seam: setSendMailImpl() / __resetForTests()
 * - Entry-point guard: fileURLToPath(import.meta.url) === process.argv[1]
 * - Cron options: { timezone, noOverlap: true, name }
 * - Worker must NOT crash the server on any failure
 */
import { fileURLToPath } from 'node:url'
import cron, { type ScheduledTask } from 'node-cron'
import nodemailer from 'nodemailer'
import dotenv from 'dotenv'
import { logger } from '../logger.js'
import { getAllDeadlines, getAllDeadlineTypes } from '../queries.js'
import { toISODateString } from '../../shared/lib/date.js'
import {
  filterDigest,
  renderPlainText,
  renderHTML,
  buildSubject,
  type DigestDeadline,
} from './email-render.js'

// ─────────────────────────────────────────────────────────────────────────────
// Dependency-injection seam (tests override via setSendMailImpl)
// ─────────────────────────────────────────────────────────────────────────────

export type SendMailFn = (opts: nodemailer.SendMailOptions) => Promise<nodemailer.SentMessageInfo>

// Default throws — replaced by buildAndWireTransporter at startup, or by tests via setSendMailImpl
let sendMailImpl: SendMailFn = async () => {
  throw new Error('sendMailImpl not set — startEmailWorker must be called before sendDigest')
}

export function setSendMailImpl(fn: SendMailFn): void {
  sendMailImpl = fn
}

// ─────────────────────────────────────────────────────────────────────────────
// Module-level state (all reset by __resetForTests)
// ─────────────────────────────────────────────────────────────────────────────

let cronTask: ScheduledTask | null = null
let transporter: nodemailer.Transporter | null = null

// ─────────────────────────────────────────────────────────────────────────────
// Required environment variables
// ─────────────────────────────────────────────────────────────────────────────

const REQUIRED_ENV = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM', 'SMTP_TO'] as const

// ─────────────────────────────────────────────────────────────────────────────
// Internal helper: build transporter and wire DI seam
// ─────────────────────────────────────────────────────────────────────────────

async function buildAndWireTransporter(): Promise<void> {
  // Pitfall 1: SMTP_PORT is a string in process.env — cast to Number before use.
  // String equality with 465 would always be false without the cast.
  const smtpPort = Number(process.env.SMTP_PORT)

  transporter = nodemailer.createTransport(
    {
      host: process.env.SMTP_HOST!,
      port: smtpPort,
      secure: smtpPort === 465,           // true = SMTPS (port 465); false = STARTTLS (port 587)
      requireTLS: smtpPort !== 465,       // force STARTTLS when NOT using implicit TLS; T-10-DOWNGRADE mitigation
      auth: {
        user: process.env.SMTP_USER!,
        pass: process.env.SMTP_PASS!,     // object API — no URL encoding needed for special chars (Pitfall: connection string)
      },
    },
    {
      // Operational hygiene: X-Mailer header on every message from this transporter
      headers: { 'X-Mailer': 'Case Calendar/v1' },
    }
  )

  // Wire DI seam to the real transporter's sendMail
  sendMailImpl = (opts) => transporter!.sendMail(opts)
}

// ─────────────────────────────────────────────────────────────────────────────
// sendDigest: query DB, join types, filter, render, send
// ─────────────────────────────────────────────────────────────────────────────

export async function sendDigest(): Promise<void> {
  // SAFE-03: new Date() with NO argument is the only permitted Date construction.
  // toISODateString converts the Date to 'YYYY-MM-DD' in local time.
  const today = toISODateString(new Date())

  // Synchronous better-sqlite3 calls
  const rawDeadlines = getAllDeadlines()
  const types = getAllDeadlineTypes()

  // Build type index for O(1) join
  const typeIndex = new Map(types.map((t) => [t.id, t]))

  // Join type metadata into each deadline; fall back for unknown/deleted types
  const deadlines: DigestDeadline[] = rawDeadlines.map((d) => {
    const t = typeIndex.get(d.typeId)
    return {
      id: d.id,
      date: d.date,
      caseLabel: d.caseLabel,
      typeName: t?.name ?? 'Unknown',       // T-10-INJECT: escHtml applied in email-render.ts
      typeColor: t?.color ?? '#6b7280',      // gray fallback for deleted types
      description: d.description ?? null,
      completedAt: d.completedAt ?? null,
    }
  })

  // Pure transform: filter to overdue + 14-day window
  const data = filterDigest(deadlines, today)

  // Build email content
  const subject = buildSubject(data)
  const text = renderPlainText(data)
  const html = renderHTML(data)

  // Send via DI seam (real nodemailer in prod; mock in tests)
  // nodemailer auto-generates multipart/alternative when both text and html are set
  const info = await sendMailImpl({
    from: process.env.SMTP_FROM!,
    to: process.env.SMTP_TO!,
    subject,
    text,
    html,
  })

  const count = data.overdue.length + data.grouped.reduce((s, g) => s + g.deadlines.length, 0)
  logger.info({ messageId: info.messageId, count, to: process.env.SMTP_TO }, 'email digest sent')
}

// ─────────────────────────────────────────────────────────────────────────────
// startEmailWorker: entry point called from index.ts (and via entry-point guard)
// ─────────────────────────────────────────────────────────────────────────────

export async function startEmailWorker(): Promise<void> {
  // 1. Load .env.local FIRST — before any process.env read (Pitfall 3: dotenv after env read)
  // dotenv does NOT override vars already set in the OS environment (NSSM sets TZ etc.)
  dotenv.config({ path: '.env.local' })

  // 2. Graceful no-op when not configured (EMAIL-02: env-only config)
  if (process.env.EMAIL_DIGEST_ENABLED !== 'true') {
    logger.info('email digest disabled (set EMAIL_DIGEST_ENABLED=true in .env.local)')
    return
  }

  const missing = REQUIRED_ENV.filter((k) => !process.env[k])
  if (missing.length > 0) {
    logger.info({ missing }, 'email digest disabled (missing env vars)')
    return
  }

  // 3. --once mode: build transporter, send one digest, exit
  // Called before verify() so direct invoke works even if verify() would fail
  if (process.argv.includes('--once')) {
    await buildAndWireTransporter()
    try {
      await sendDigest()
      process.exit(0)
    } catch (err) {
      logger.error({ err }, 'email digest --once failed')
      process.exit(1)
    }
  }

  // 4. Normal startup: build transporter and wire DI seam
  await buildAndWireTransporter()

  // 5. Fast-fail verify — do NOT crash server on SMTP failure (Pitfall 8: T-10-CRASH mitigation)
  // verify() resolves on success, throws on auth/connection failure
  try {
    await transporter!.verify()
    logger.info('email: SMTP connection verified')
  } catch (err) {
    logger.warn({ err }, 'email: SMTP verify failed — digest disabled until config is fixed')
    return  // No cron scheduled — operator must fix config and restart
  }

  // 6. Schedule daily 7:00 AM digest (EMAIL-01)
  // T-10-OVERLAP mitigation: noOverlap: true prevents overlapping sends on slow SMTP
  // Pitfall 4: node-cron uses 5-field POSIX cron, NOT 6-field (seconds-first) format
  cronTask = cron.schedule(
    '0 7 * * *',
    async () => {
      try {
        await sendDigest()
      } catch (err) {
        // sendMail failure → log warn, no retry, stay scheduled (no rethrow)
        logger.warn({ err }, 'email digest send failed')
      }
    },
    {
      timezone: process.env.TZ ?? 'America/Los_Angeles',
      noOverlap: true,           // T-10-OVERLAP mitigation
      name: 'email-digest-cron',
    }
  )

  logger.info(
    { schedule: '0 7 * * *', tz: process.env.TZ ?? 'America/Los_Angeles' },
    'email digest worker started'
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Module entry-point guard (for `npm run email:once` via tsx)
// ─────────────────────────────────────────────────────────────────────────────

// When email.ts is run directly (tsx src/server/workers/email.ts --once),
// import.meta.url resolves to this file's path which matches process.argv[1].
// When email.ts is imported by index.ts, import.meta.url !== process.argv[1]
// and this guard is inert (no double-start).
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  void startEmailWorker()
}

// ─────────────────────────────────────────────────────────────────────────────
// Test reset helper (VITEST only — mirrors wallpaper.ts __resetForTests)
// ─────────────────────────────────────────────────────────────────────────────

export function __resetForTests(): void {
  if (cronTask) {
    cronTask.destroy()
    cronTask = null
  }
  transporter = null
  // Restore throwing default so tests that forget to call setSendMailImpl fail loudly
  sendMailImpl = async () => {
    throw new Error('sendMailImpl not set — startEmailWorker must be called before sendDigest')
  }
}
