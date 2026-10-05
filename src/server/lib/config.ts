/**
 * In-app setup (Settings > Setup): values that used to live only in .env.local.
 *
 * Saved values are stored in app_settings under `env:<NAME>` and copied into process.env,
 * so every existing reader (workers, LLM calls) keeps reading process.env unchanged.
 * Precedence: saved in the app > .env.local / OS environment > built-in default.
 * An empty saved value means "not set", even when .env.local has one (it is kept as ''
 * in process.env so a later dotenv.config() call cannot bring the old value back).
 *
 * Secrets (passwords, API keys) are never sent back to the browser, only whether they are set.
 */
import { getSetting, setSetting } from '../queries.js'
import { sqlite } from '../db.js'

export type ConfigKey =
  | 'TZ'
  | 'LLM_PROVIDER' | 'OPENAI_API_KEY' | 'OPENAI_MODEL' | 'ANTHROPIC_API_KEY'
  | 'SMTP_USER' | 'SMTP_PASS' | 'SMTP_HOST' | 'SMTP_PORT' | 'IMAP_HOST' | 'IMAP_PORT'
  | 'EMAIL_DIGEST_ENABLED' | 'SMTP_TO' | 'SMTP_FROM'
  | 'EMAIL_IMPORT_ENABLED' | 'EMAIL_IMPORT_ADDRESS' | 'EMAIL_IMPORT_ALLOWED_SENDERS'
  | 'WALLPAPER_ENABLED'
  | 'UPDATE_GITHUB_TOKEN'

type Kind = 'text' | 'secret' | 'bool' | 'port' | 'timezone' | 'provider' | 'email' | 'emails'

export const CONFIG_FIELDS: Record<ConfigKey, { kind: Kind }> = {
  TZ: { kind: 'timezone' },
  LLM_PROVIDER: { kind: 'provider' },
  OPENAI_API_KEY: { kind: 'secret' },
  OPENAI_MODEL: { kind: 'text' },
  ANTHROPIC_API_KEY: { kind: 'secret' },
  SMTP_USER: { kind: 'email' },
  SMTP_PASS: { kind: 'secret' },
  SMTP_HOST: { kind: 'text' },
  SMTP_PORT: { kind: 'port' },
  IMAP_HOST: { kind: 'text' },
  IMAP_PORT: { kind: 'port' },
  EMAIL_DIGEST_ENABLED: { kind: 'bool' },
  SMTP_TO: { kind: 'email' },
  SMTP_FROM: { kind: 'text' },
  EMAIL_IMPORT_ENABLED: { kind: 'bool' },
  EMAIL_IMPORT_ADDRESS: { kind: 'email' },
  EMAIL_IMPORT_ALLOWED_SENDERS: { kind: 'emails' },
  WALLPAPER_ENABLED: { kind: 'bool' },
  UPDATE_GITHUB_TOKEN: { kind: 'secret' },
}

export const CONFIG_KEYS = Object.keys(CONFIG_FIELDS) as ConfigKey[]

export function isConfigKey(k: string): k is ConfigKey {
  return Object.prototype.hasOwnProperty.call(CONFIG_FIELDS, k)
}

const PREFIX = 'env:'
const EMAIL_RE = /^[^\s@<>,]+@[^\s@<>,]+\.[^\s@<>,]+$/

/** The computer's own time zone, ignoring any TZ override. */
export const SYSTEM_TIME_ZONE = (() => {
  const saved = process.env.TZ
  // Read before any TZ override is applied; captured once at import
  return saved ? saved : Intl.DateTimeFormat().resolvedOptions().timeZone
})()

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/** Validate one value; returns an error message or null. '' (not set) is always allowed. */
export function validateConfigValue(key: ConfigKey, raw: string): string | null {
  const v = raw.trim()
  if (raw.length > 2000) return 'Too long.'
  if (v === '') return null
  switch (CONFIG_FIELDS[key].kind) {
    case 'bool': return v === 'true' || v === 'false' ? null : 'Must be true or false.'
    case 'port': return /^\d{1,5}$/.test(v) && Number(v) > 0 && Number(v) < 65536 ? null : 'Must be a port number (1-65535).'
    case 'timezone': return isValidTimeZone(v) ? null : 'Unknown time zone.'
    case 'provider': return v === 'openai' || v === 'anthropic' ? null : 'Must be openai or anthropic.'
    case 'email': return EMAIL_RE.test(v) ? null : 'Not a valid email address.'
    case 'emails': return v.split(',').map(s => s.trim()).filter(Boolean).every(s => EMAIL_RE.test(s)) ? null : 'Use email addresses separated by commas.'
    default: return null
  }
}

/** Value as stored (trimmed; app passwords lose their display spaces). */
function normalize(key: ConfigKey, raw: string): string {
  const v = raw.trim()
  if (key === 'SMTP_PASS') return v.replace(/\s+/g, '')
  if (CONFIG_FIELDS[key].kind === 'email' || CONFIG_FIELDS[key].kind === 'emails') return v.toLowerCase()
  return v
}

/** Values from .env.local / the OS environment, captured before saved values are applied. */
let baseline: Partial<Record<ConfigKey, string | undefined>> | null = null
function captureBaseline(): void {
  if (baseline) return
  baseline = {}
  for (const k of CONFIG_KEYS) baseline[k] = process.env[k]
}

function storedValue(key: ConfigKey): string | null {
  return getSetting(PREFIX + key)
}

/** Copy every saved value into process.env (at boot, and after a save). */
export function applyStoredConfig(): void {
  captureBaseline()
  for (const k of CONFIG_KEYS) {
    const v = storedValue(k)
    if (v !== null) process.env[k] = v
  }
  deriveDefaults()
}

/**
 * Fill what can be derived once an email account is set, so the setup screen only needs
 * the address and app password: Gmail's servers, and the digest sent from/to that address.
 * Also the time zone: saved > environment > the computer's own.
 */
function deriveDefaults(): void {
  if (!process.env.TZ) process.env.TZ = SYSTEM_TIME_ZONE
  const user = process.env.SMTP_USER
  if (!user) return
  if (!process.env.SMTP_HOST) process.env.SMTP_HOST = 'smtp.gmail.com'
  if (!process.env.SMTP_PORT) process.env.SMTP_PORT = '587'
  if (!process.env.SMTP_FROM) process.env.SMTP_FROM = `Case Calendar <${user}>`
  if (!process.env.SMTP_TO) process.env.SMTP_TO = user
}

export type ConfigSource = 'app' | 'env' | 'unset'
export interface ConfigFieldView { value: string | null; set: boolean; source: ConfigSource }

/** What Settings > Setup shows. Secret values are never included, only whether they are set. */
export function configView(): Record<ConfigKey, ConfigFieldView> {
  captureBaseline()
  const out = {} as Record<ConfigKey, ConfigFieldView>
  for (const k of CONFIG_KEYS) {
    const stored = storedValue(k)
    const effective = process.env[k] ?? ''
    const source: ConfigSource = stored !== null ? 'app' : baseline![k] ? 'env' : 'unset'
    out[k] = {
      value: CONFIG_FIELDS[k].kind === 'secret' ? null : effective,
      set: effective !== '',
      source,
    }
  }
  return out
}

/**
 * Save values (all-or-nothing: every value is validated first). Returns the keys whose
 * effective value changed, so the caller can restart what depends on them.
 */
export function saveConfig(values: Partial<Record<ConfigKey, string>>): { changed: ConfigKey[] } | { errors: Partial<Record<ConfigKey, string>> } {
  captureBaseline()
  const errors: Partial<Record<ConfigKey, string>> = {}
  for (const [k, v] of Object.entries(values) as [ConfigKey, string][]) {
    const err = validateConfigValue(k, v)
    if (err) errors[k] = err
  }
  if (Object.keys(errors).length > 0) return { errors }

  const changed: ConfigKey[] = []
  sqlite.transaction(() => {
    for (const [k, raw] of Object.entries(values) as [ConfigKey, string][]) {
      const v = normalize(k, raw)
      if ((process.env[k] ?? '') !== v) changed.push(k)
      setSetting(PREFIX + k, v)
    }
  })()
  for (const k of changed) process.env[k] = normalize(k, values[k]!)
  deriveDefaults()
  return { changed }
}
