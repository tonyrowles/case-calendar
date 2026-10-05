/**
 * Email import: turn orders emailed to EMAIL_IMPORT_ADDRESS (e.g. you+calendar@gmail.com)
 * into proposals waiting in the app's Inbox for review. Nothing is ever saved as a
 * deadline without the user confirming it there.
 *
 * - Polls the IMAP inbox every 5 minutes (and shortly after startup). Read-only: messages
 *   are not marked read, moved or deleted. Each Message-ID is processed once.
 * - Only allowed senders whose message passed Gmail's own DMARC/DKIM/SPF checks are sent
 *   to the extractor; others are recorded as "rejected" (visible in the Inbox).
 * - The email text is sent to the selected LLM provider for extraction (same as Import;
 *   OpenAI when OPENAI_API_KEY is set, else Anthropic: see lib/llm.ts).
 *
 * .env.local:
 *   EMAIL_IMPORT_ENABLED=true
 *   EMAIL_IMPORT_ADDRESS=you+calendar@gmail.com
 *   EMAIL_IMPORT_ALLOWED_SENDERS=you@gmail.com,you@firm.com   (default: IMAP_USER)
 *   IMAP_HOST / IMAP_PORT / IMAP_USER / IMAP_PASS             (default: imap.gmail.com:993
 *                                                              and SMTP_USER / SMTP_PASS)
 */
import cron, { type ScheduledTask } from 'node-cron'
import { ImapFlow } from 'imapflow'
import { simpleParser, type ParsedMail } from 'mailparser'
import { logger } from '../logger.js'
import { addEmailImport, getAllDeadlineTypes, hasEmailImport, listDistinctCaseLabels } from '../queries.js'
import { ExtractorFailedError, extractDeadlines } from '../lib/deadline-extractor.js'
import { toProposals } from '../lib/proposals.js'
import { llmConfigured } from '../lib/llm.js'
import { toISODateString } from '../../shared/lib/date.js'

const CRON_EXPR = '*/5 * * * *'
const LOOKBACK_DAYS = 14
const MAX_PER_POLL = 20
const MAX_TEXT_CHARS = 50_000

// --- Config -------------------------------------------------------------------

export interface EmailImportConfig {
  address: string
  allowedSenders: string[]
  imap: { host: string; port: number; user: string; pass: string }
}

/** The config when email import is enabled and complete, else null. */
export function emailImportConfig(env: NodeJS.ProcessEnv = process.env): EmailImportConfig | null {
  if (env.EMAIL_IMPORT_ENABLED !== 'true') return null
  const address = env.EMAIL_IMPORT_ADDRESS?.trim().toLowerCase()
  const user = (env.IMAP_USER || env.SMTP_USER)?.trim()
  const pass = (env.IMAP_PASS || env.SMTP_PASS)?.replace(/\s+/g, '')
  if (!address || !user || !pass) return null
  const allowed = (env.EMAIL_IMPORT_ALLOWED_SENDERS?.trim() || user)
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  return {
    address,
    allowedSenders: allowed,
    imap: { host: env.IMAP_HOST?.trim() || 'imap.gmail.com', port: Number(env.IMAP_PORT) || 993, user, pass },
  }
}

// --- Sender verification --------------------------------------------------------

/**
 * Allowed sender AND a passing check recorded by the receiving server (Gmail stamps
 * "Authentication-Results: mx.google.com; ..."). Results stamped by any other host are
 * ignored: a sender could forge those.
 */
export function verifySender(
  fromAddress: string,
  authResults: string[],
  allowed: string[],
  receivingHost = 'mx.google.com',
): { ok: true } | { ok: false; reason: string } {
  const from = fromAddress.trim().toLowerCase()
  if (!allowed.includes(from)) {
    return { ok: false, reason: `Sender ${from || '(unknown)'} is not on the allowed list (EMAIL_IMPORT_ALLOWED_SENDERS).` }
  }
  const domain = from.split('@')[1] ?? ''
  const trusted = authResults.filter(h => h.trim().toLowerCase().startsWith(receivingHost))
  const aligned = (d: string | undefined) => !!d && (d === domain || d.endsWith(`.${domain}`))
  for (const h of trusted.map(t => t.toLowerCase())) {
    if (/\bdmarc=pass\b/.test(h)) return { ok: true }
    for (const m of h.matchAll(/\bdkim=pass\b[^;]*?header\.[id]=@?([a-z0-9.-]+)/g)) if (aligned(m[1])) return { ok: true }
    for (const m of h.matchAll(/\bspf=pass\b[^;]*?smtp\.mailfrom=(?:[^@\s;]*@)?([a-z0-9.-]+)/g)) if (aligned(m[1])) return { ok: true }
  }
  return { ok: false, reason: 'Could not verify the sender: the message did not pass Gmail\'s DMARC, DKIM or SPF checks.' }
}

// --- Mailbox access (injectable for tests) ----------------------------------------

/** Raw RFC 822 sources of recent messages addressed to `address`. */
export type FetchMessagesFn = (cfg: EmailImportConfig, since: Date) => Promise<Buffer[]>

const imapFetch: FetchMessagesFn = async (cfg, since) => {
  const client = new ImapFlow({
    host: cfg.imap.host,
    port: cfg.imap.port,
    secure: true,
    auth: { user: cfg.imap.user, pass: cfg.imap.pass },
    logger: false,
  })
  await client.connect()
  try {
    const lock = await client.getMailboxLock('INBOX', { readOnly: true })
    try {
      const uids = (await client.search({ to: cfg.address, since }, { uid: true })) || []
      const out: Buffer[] = []
      for (const uid of uids.slice(-MAX_PER_POLL)) {
        const msg = await client.fetchOne(String(uid), { source: true }, { uid: true })
        if (msg && msg.source) out.push(msg.source)
      }
      return out
    } finally {
      lock.release()
    }
  } finally {
    await client.logout().catch(() => client.close())
  }
}

let fetchImpl: FetchMessagesFn = imapFetch
export function __setFetchMessages(fn: FetchMessagesFn): void { fetchImpl = fn }
export function __resetFetchMessages(): void { fetchImpl = imapFetch }

// --- Processing -------------------------------------------------------------------

function authResultsOf(mail: ParsedMail): string[] {
  return mail.headerLines
    .filter(l => l.key === 'authentication-results')
    .map(l => l.line.replace(/^authentication-results:\s*/i, '').replace(/\r?\n\s+/g, ' '))
}

export interface PollResult { checked: number; added: number; rejected: number; failed: number; skippedNoKey: number }

/** Check the mailbox once and record each new message. */
export async function pollEmailImports(cfg: EmailImportConfig, now = new Date()): Promise<PollResult> {
  const since = new Date(now.getTime() - LOOKBACK_DAYS * 86_400_000)
  const sources = await fetchImpl(cfg, since)
  const result: PollResult = { checked: sources.length, added: 0, rejected: 0, failed: 0, skippedNoKey: 0 }

  for (const source of sources) {
    const mail = await simpleParser(source)
    const messageId = mail.messageId?.trim()
    if (!messageId || hasEmailImport(messageId)) continue

    const fromAddress = mail.from?.value[0]?.address?.toLowerCase() ?? ''
    const subject = mail.subject?.trim() || '(no subject)'
    const receivedAt = (mail.date ?? now).toISOString()
    const base = { messageId, fromAddress, subject, receivedAt }

    const sender = verifySender(fromAddress, authResultsOf(mail), cfg.allowedSenders)
    if (!sender.ok) {
      addEmailImport({ ...base, status: 'rejected', reason: sender.reason })
      result.rejected++
      logger.warn({ fromAddress, reason: sender.reason }, 'email-import: rejected')
      continue
    }
    if (!llmConfigured()) {
      // Leave it unrecorded so it is processed once a key is configured
      result.skippedNoKey++
      continue
    }

    const body = (mail.text ?? '').trim()
    const text = `Subject: ${subject}\nFrom: ${fromAddress}\nDate: ${receivedAt}\n\n${body}`
    if (text.length > MAX_TEXT_CHARS) {
      addEmailImport({ ...base, status: 'failed', reason: 'The email is too long to import (50,000 characters max). Paste the relevant part into Import instead.' })
      result.failed++
      continue
    }

    try {
      const types = getAllDeadlineTypes()
      const knownCases = listDistinctCaseLabels()
      const raw = await extractDeadlines({
        text,
        typeNames: types.map(t => t.name),
        knownCases,
        caseHint: null,
        today: toISODateString(now),
      })
      if (raw.length === 0) {
        addEmailImport({ ...base, status: 'failed', reason: 'No dated deadlines were found in this email.' })
        result.failed++
      } else {
        addEmailImport({ ...base, status: 'pending', proposals: toProposals(raw, types, knownCases, null) })
        result.added++
      }
    } catch (err) {
      const reason = err instanceof ExtractorFailedError ? err.message : 'Extraction failed unexpectedly.'
      addEmailImport({ ...base, status: 'failed', reason })
      result.failed++
      logger.error({ err }, 'email-import: extraction failed')
    }
  }
  return result
}

// --- Worker -------------------------------------------------------------------------

let lastCheck: { at: string; ok: boolean; error: string | null } | null = null
let running = false
let cronTask: ScheduledTask | null = null
let startupTimer: ReturnType<typeof setTimeout> | null = null

export function emailImportStatus(): { at: string; ok: boolean; error: string | null } | null {
  return lastCheck
}

export async function checkEmailNow(): Promise<void> {
  const cfg = emailImportConfig()
  if (!cfg || running) return
  running = true
  try {
    const r = await pollEmailImports(cfg)
    lastCheck = {
      at: new Date().toISOString(),
      ok: true,
      error: r.skippedNoKey > 0 ? 'Emails are waiting: add an OpenAI or Anthropic API key in Settings > Setup to read them.' : null,
    }
    if (r.added || r.rejected || r.failed) logger.info(r, 'email-import: poll')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    lastCheck = { at: new Date().toISOString(), ok: false, error: `Could not check the mailbox: ${message}` }
    logger.error({ err }, 'email-import: poll failed')
  } finally {
    running = false
  }
}

export function startEmailImportWorker(): void {
  const cfg = emailImportConfig()
  if (!cfg) {
    logger.info('email import disabled (turn it on in Settings > Setup)')
    return
  }
  cronTask = cron.schedule(CRON_EXPR, () => { void checkEmailNow() }, { noOverlap: true, name: 'email-import' })
  startupTimer = setTimeout(() => { void checkEmailNow() }, 15_000)
  logger.info({ address: cfg.address, schedule: CRON_EXPR }, 'email import worker started')
}

export function stopEmailImportWorker(): void {
  cronTask?.stop()
  cronTask = null
  if (startupTimer) clearTimeout(startupTimer)
  startupTimer = null
}
export const __stopEmailImportWorker = stopEmailImportWorker

/** Pick up changed settings: stop, then start again if still configured. */
export function restartEmailImportWorker(): void {
  stopEmailImportWorker()
  lastCheck = null
  startEmailImportWorker()
}
