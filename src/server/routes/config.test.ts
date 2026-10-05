// Routes: /api/config (Settings > Setup). Services are mocked: these tests check storage,
// validation, secrecy and which settings changed, not the workers themselves.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

vi.mock('../services.js', () => ({
  applyConfigChanges: vi.fn().mockResolvedValue(undefined),
  startServices: vi.fn(),
}))

import { app } from '../index.js'
import { sqlite } from '../db.js'
import { applyConfigChanges } from '../services.js'
import { CONFIG_KEYS, applyStoredConfig } from '../lib/config.js'

const saved: Record<string, string | undefined> = {}

function put(values: Record<string, string>) {
  return app.request('/api/config', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ values }),
  })
}
async function get() {
  return (await app.request('/api/config')).json()
}

describe('/api/config', () => {
  beforeEach(() => {
    sqlite.exec('DELETE FROM app_settings')
    for (const k of [...CONFIG_KEYS, 'TZ']) saved[k] = process.env[k]
    vi.mocked(applyConfigChanges).mockClear()
  })
  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  })

  it('CF1: saves values into the running server; secrets come back only as "set"', async () => {
    const res = await put({ OPENAI_API_KEY: 'sk-test-123', OPENAI_MODEL: 'gpt-5.6-mini' })
    expect(res.status).toBe(200)
    expect(process.env.OPENAI_API_KEY).toBe('sk-test-123')
    const body = await res.json()
    expect(body.fields.OPENAI_API_KEY).toEqual({ value: null, set: true, source: 'app' })
    expect(body.fields.OPENAI_MODEL).toMatchObject({ value: 'gpt-5.6-mini', source: 'app' })
    expect(JSON.stringify(await get())).not.toContain('sk-test-123')
    expect(body.status.ai).toEqual({ provider: 'openai', configured: true })
  })

  it('CF2: reports only the settings that actually changed', async () => {
    await put({ OPENAI_MODEL: 'gpt-5.6' })
    vi.mocked(applyConfigChanges).mockClear()
    await put({ OPENAI_MODEL: 'gpt-5.6', EMAIL_IMPORT_ENABLED: 'true' })
    expect(applyConfigChanges).toHaveBeenCalledWith(['EMAIL_IMPORT_ENABLED'])
  })

  it('CF3: rejects invalid values (nothing saved) and unknown settings', async () => {
    const res = await put({ TZ: 'Mars/Olympus', SMTP_PORT: '99999', OPENAI_MODEL: 'ok' })
    expect(res.status).toBe(422)
    const { error } = await res.json()
    expect(Object.keys(error.fields).sort()).toEqual(['SMTP_PORT', 'TZ'])
    expect((await get()).fields.OPENAI_MODEL.source).not.toBe('app')
    expect((await put({ NODE_ENV: 'development' })).status).toBe(422)
    expect((await put({ EMAIL_IMPORT_ALLOWED_SENDERS: 'me@x.com, not-an-email' })).status).toBe(422)
  })

  it('CF4: the time zone applies immediately and changes "today"', async () => {
    const at = new Date('2026-01-01T07:30:00Z')   // Dec 31 in Los Angeles, Jan 1 in Tokyo
    expect(at.getDate()).toBe(31)
    expect((await put({ TZ: 'Asia/Tokyo' })).status).toBe(200)
    expect(at.getDate()).toBe(1)
    // '' = back to the default zone
    await put({ TZ: '' })
    expect(process.env.TZ).toBe((await get()).defaultTimeZone)
  })

  it('CF5: an email account fills in Gmail servers and the digest sender/recipient', async () => {
    for (const k of ['SMTP_HOST', 'SMTP_PORT', 'SMTP_FROM', 'SMTP_TO']) delete process.env[k]
    await put({ SMTP_USER: 'Me@Example.com', SMTP_PASS: 'abcd efgh ijkl mnop' })
    expect(process.env.SMTP_USER).toBe('me@example.com')
    expect(process.env.SMTP_PASS).toBe('abcdefghijklmnop')
    expect(process.env.SMTP_HOST).toBe('smtp.gmail.com')
    expect(process.env.SMTP_PORT).toBe('587')
    expect(process.env.SMTP_TO).toBe('me@example.com')
    expect(process.env.SMTP_FROM).toBe('Case Calendar <me@example.com>')
  })

  it('CF6: saved values survive a restart and override .env.local; empty means not set', async () => {
    await put({ ANTHROPIC_API_KEY: '' , OPENAI_MODEL: 'gpt-x' })
    process.env.ANTHROPIC_API_KEY = 'from-env-file'
    process.env.OPENAI_MODEL = 'from-env-file'
    applyStoredConfig()
    expect(process.env.ANTHROPIC_API_KEY).toBe('')
    expect(process.env.OPENAI_MODEL).toBe('gpt-x')
  })
})
