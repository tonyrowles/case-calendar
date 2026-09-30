// Email import: sender verification, polling -> inbox records, and the inbox routes
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { app } from '../index.js'
import { sqlite } from '../db.js'
import { __resetExtractModel, setExtractModel } from '../lib/deadline-extractor.js'
import {
  __resetFetchMessages,
  __setFetchMessages,
  emailImportConfig,
  pollEmailImports,
  verifySender,
  type EmailImportConfig,
} from './email-import.js'

const ME = 'jdoe@gmail.com'
const GMAIL_PASS = 'mx.google.com; dkim=pass header.i=@gmail.com header.s=20230601; spf=pass (google.com: domain of jdoe@gmail.com designates 1.2.3.4 as permitted sender) smtp.mailfrom=jdoe@gmail.com; dmarc=pass (p=NONE) header.from=gmail.com'

function rawEmail({ id, from = ME, subject = 'Scheduling order', body = 'Hearing on Nov 20, 2026.', auth = GMAIL_PASS }:
  { id: string; from?: string; subject?: string; body?: string; auth?: string | null }): Buffer {
  const lines = [
    ...(auth ? [`Authentication-Results: ${auth}`] : []),
    `From: Tony <${from}>`,
    'To: jdoe+calendar@gmail.com',
    `Subject: ${subject}`,
    'Date: Wed, 30 Sep 2026 10:00:00 -0700',
    `Message-ID: <${id}@mail.gmail.com>`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ]
  return Buffer.from(lines.join('\r\n'))
}

const CFG: EmailImportConfig = {
  address: 'jdoe+calendar@gmail.com',
  allowedSenders: [ME],
  imap: { host: 'imap.gmail.com', port: 993, user: ME, pass: 'x' },
}

describe('verifySender', () => {
  it('accepts an allowed sender whose message passed Gmail\'s checks', () => {
    expect(verifySender(ME, [GMAIL_PASS], [ME])).toEqual({ ok: true })
    // DKIM alone (aligned domain) is enough
    expect(verifySender(ME, ['mx.google.com; dkim=pass header.i=@gmail.com'], [ME])).toEqual({ ok: true })
  })

  it('rejects senders not on the allow list', () => {
    const r = verifySender('stranger@example.com', [GMAIL_PASS], [ME])
    expect(r.ok).toBe(false)
  })

  it('rejects a forged From: failing checks, misaligned DKIM, or results stamped by another host', () => {
    expect(verifySender(ME, ['mx.google.com; dkim=fail; spf=softfail; dmarc=fail'], [ME]).ok).toBe(false)
    expect(verifySender(ME, ['mx.google.com; dkim=pass header.i=@attacker.com; spf=pass smtp.mailfrom=x@attacker.com'], [ME]).ok).toBe(false)
    expect(verifySender(ME, ['evil.example.com; dmarc=pass'], [ME]).ok).toBe(false)
    expect(verifySender(ME, [], [ME]).ok).toBe(false)
  })
})

describe('emailImportConfig', () => {
  it('is off unless enabled with an address; reuses SMTP credentials and defaults the allow list to the mailbox', () => {
    expect(emailImportConfig({ SMTP_USER: ME, SMTP_PASS: 'abcd efgh ijkl mnop' })).toBeNull()
    expect(emailImportConfig({ EMAIL_IMPORT_ENABLED: 'true', SMTP_USER: ME, SMTP_PASS: 'p' })).toBeNull()
    const cfg = emailImportConfig({
      EMAIL_IMPORT_ENABLED: 'true', EMAIL_IMPORT_ADDRESS: 'jdoe+Calendar@gmail.com',
      SMTP_USER: ME, SMTP_PASS: 'abcd efgh ijkl mnop',
    })!
    expect(cfg.address).toBe('jdoe+calendar@gmail.com')
    expect(cfg.allowedSenders).toEqual([ME])
    expect(cfg.imap).toEqual({ host: 'imap.gmail.com', port: 993, user: ME, pass: 'abcdefghijklmnop' })
  })
})

describe('pollEmailImports + /api/email-imports', () => {
  let savedKey: string | undefined
  beforeEach(() => {
    savedKey = process.env.ANTHROPIC_API_KEY
    process.env.ANTHROPIC_API_KEY = 'test-key'
    sqlite.exec('DELETE FROM email_imports; DELETE FROM deadlines; DELETE FROM deadline_types')
    sqlite.prepare("INSERT INTO deadline_types (id, name, color) VALUES (2, 'Hearing', '#B91C1C'), (9, 'Other', '#374151')").run()
    setExtractModel(async (req) => req.text.includes('Hearing')
      ? [{ date: '2026-11-20', caseLabel: 'Smith v. Jones', typeName: 'Hearing', title: 'Hearing on MSJ', notes: '', dateBasis: 'stated', basis: '', sourceText: 'Hearing on Nov 20, 2026.' }]
      : [])
  })
  afterEach(() => {
    __resetExtractModel()
    __resetFetchMessages()
    if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = savedKey
  })

  it('EI1: records pending/rejected/failed emails, and never processes a message twice', async () => {
    __setFetchMessages(async () => [
      rawEmail({ id: 'a' }),
      rawEmail({ id: 'b', from: 'stranger@example.com' }),
      rawEmail({ id: 'c', body: 'Nothing scheduled.' }),
      rawEmail({ id: 'd', auth: 'mx.google.com; dkim=fail; spf=fail; dmarc=fail' }),
    ])
    expect(await pollEmailImports(CFG)).toMatchObject({ checked: 4, added: 1, rejected: 2, failed: 1 })
    expect(await pollEmailImports(CFG)).toMatchObject({ checked: 4, added: 0, rejected: 0, failed: 0 })

    const rows = sqlite.prepare('SELECT messageId, status FROM email_imports ORDER BY messageId').all()
    expect(rows).toEqual([
      { messageId: '<a@mail.gmail.com>', status: 'pending' },
      { messageId: '<b@mail.gmail.com>', status: 'rejected' },
      { messageId: '<c@mail.gmail.com>', status: 'failed' },
      { messageId: '<d@mail.gmail.com>', status: 'rejected' },
    ])
    // Nothing becomes a deadline without review
    expect(sqlite.prepare('SELECT count(*) n FROM deadlines').get()).toEqual({ n: 0 })
  })

  it('EI2: without an API key, verified emails are left for later (not recorded, not sent anywhere)', async () => {
    delete process.env.ANTHROPIC_API_KEY
    __setFetchMessages(async () => [rawEmail({ id: 'a' })])
    expect(await pollEmailImports(CFG)).toMatchObject({ added: 0, skippedNoKey: 1 })
    expect(sqlite.prepare('SELECT count(*) n FROM email_imports').get()).toEqual({ n: 0 })
  })

  it('EI3: the inbox lists pending first with proposals; accept saves deadlines and marks the email done', async () => {
    __setFetchMessages(async () => [rawEmail({ id: 'a' }), rawEmail({ id: 'b', from: 'stranger@example.com' })])
    await pollEmailImports(CFG)
    const inbox = await (await app.request('/api/email-imports')).json()
    expect(inbox.items.map((i: { status: string }) => i.status)).toEqual(['pending', 'rejected'])
    const pending = inbox.items[0]
    expect(pending.proposals[0]).toMatchObject({ date: '2026-11-20', typeId: 2, title: 'Hearing on MSJ' })

    const accept = (id: number) => app.request(`/api/email-imports/${id}/accept`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deadlines: [{ date: '2026-11-20', caseLabel: 'Smith v. Jones', typeId: 2, description: 'Hearing on MSJ' }] }),
    })
    expect((await accept(pending.id)).status).toBe(201)
    expect(sqlite.prepare('SELECT count(*) n FROM deadlines').get()).toEqual({ n: 1 })
    expect((await accept(pending.id)).status).toBe(409) // already handled: no duplicate deadlines
    expect(sqlite.prepare('SELECT count(*) n FROM deadlines').get()).toEqual({ n: 1 })
  })

  it('EI4: dismiss hides an email from the inbox; unknown ids are 404', async () => {
    __setFetchMessages(async () => [rawEmail({ id: 'a' })])
    await pollEmailImports(CFG)
    const { items } = await (await app.request('/api/email-imports')).json()
    expect((await app.request(`/api/email-imports/${items[0].id}/dismiss`, { method: 'POST' })).status).toBe(204)
    expect((await (await app.request('/api/email-imports')).json()).items).toEqual([])
    expect((await app.request('/api/email-imports/999/dismiss', { method: 'POST' })).status).toBe(404)
  })
})
