import type { Deadline, DeadlineCreate, DeadlineType, DeadlineUpdate } from '../../shared/schemas/deadline.js'
import type { CaseColorOverride } from '../../shared/lib/case-colors.js'
import type { AppSettings, SettingsUpdate } from '../../shared/schemas/settings.js'
import type { CaseSummary } from '../../shared/schemas/cases.js'
import type { DeadlineProposal } from '../../shared/schemas/imports.js'
import type { EmailInbox } from '../../shared/schemas/email-imports.js'

export type { Deadline, DeadlineCreate }

/**
 * ApiError extends Error with a `code` property so consumers can branch
 * on specific server error codes (e.g., 'type_in_use', 'type_protected').
 */
export class ApiError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

export async function getDeadlines(): Promise<Deadline[]> {
  const res = await fetch('/api/deadlines')
  if (!res.ok) throw new Error('Failed to fetch deadlines')
  return res.json()
}

export async function getDeadlineTypes(): Promise<DeadlineType[]> {
  const res = await fetch('/api/deadline-types')
  if (!res.ok) throw new Error('Failed to fetch deadline types')
  return res.json()
}

export async function createDeadline(input: DeadlineCreate): Promise<Deadline> {
  const res = await fetch('/api/deadlines', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? 'Save failed. Check your connection and try again.')
  }
  return res.json()
}

/**
 * Fetch the sorted list of distinct case labels for the CaseCombobox filter.
 * Source: GET /api/case-labels → string[] (Plan 03-02).
 * Consumed by Plan 03-03's CaseCombobox via useQuery(['case-labels']).
 */
export async function getCaseLabels(): Promise<string[]> {
  const res = await fetch('/api/case-labels')
  if (!res.ok) throw new Error('Failed to fetch case labels')
  return res.json()
}

/** GET /api/case-colors: the cases whose color the user has chosen. */
export async function getCaseColors(): Promise<CaseColorOverride[]> {
  const res = await fetch('/api/case-colors')
  if (!res.ok) throw new Error('Failed to fetch case colors')
  return res.json()
}

/** PUT /api/case-colors: pin a case to one of the palette colors. */
export async function setCaseColor(caseLabel: string, color: string): Promise<CaseColorOverride> {
  const res = await fetch('/api/case-colors', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseLabel, color }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? 'Could not save the color. Try again.')
  }
  return res.json()
}

/** DELETE /api/case-colors?caseLabel=: back to the automatic color (a 404 means already automatic). */
export async function resetCaseColor(caseLabel: string): Promise<void> {
  const res = await fetch(`/api/case-colors?caseLabel=${encodeURIComponent(caseLabel)}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? 'Could not reset the color. Try again.')
  }
}

/**
 * PATCH /api/deadlines/:id — partial update.
 * Accepts any subset of DeadlineCreate fields plus completedAt.
 * Returns the updated Deadline on 200; throws on 4xx/5xx.
 */
export async function updateDeadline(id: number, patch: DeadlineUpdate): Promise<Deadline> {
  const res = await fetch(`/api/deadlines/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? 'Update failed. Check your connection and try again.')
  }
  return res.json()
}

/**
 * DELETE /api/deadlines/:id — hard delete.
 * Returns void on 204; throws on 4xx/5xx.
 */
export async function deleteDeadline(id: number): Promise<void> {
  const res = await fetch(`/api/deadlines/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? 'Delete failed. Check your connection and try again.')
  }
}

/**
 * POST /api/deadline-types — create a new deadline type.
 * Returns the created DeadlineType on 201; throws ApiError on 4xx/5xx.
 */
export async function createDeadlineType(input: { name: string; color: string }): Promise<DeadlineType> {
  const res = await fetch('/api/deadline-types', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const code = body?.error?.code ?? 'unknown'
    const message = body?.error?.message ?? 'Save failed. Check your connection and try again.'
    throw new ApiError(message, code)
  }
  return res.json()
}

/**
 * PATCH /api/deadline-types/:id — partial update (name and/or color).
 * Returns the updated DeadlineType on 200; throws ApiError on 4xx/5xx.
 */
export async function updateDeadlineType(
  id: number,
  patch: { name?: string; color?: string }
): Promise<DeadlineType> {
  const res = await fetch(`/api/deadline-types/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const code = body?.error?.code ?? 'unknown'
    const message = body?.error?.message ?? 'Update failed. Check your connection and try again.'
    throw new ApiError(message, code)
  }
  return res.json()
}

/**
 * DELETE /api/deadline-types/:id — delete a deadline type.
 * Returns void on 204; throws ApiError on 4xx/5xx (including 409 type_in_use / type_protected).
 */
export async function deleteDeadlineType(id: number): Promise<void> {
  const res = await fetch(`/api/deadline-types/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const code = body?.error?.code ?? 'unknown'
    const message = body?.error?.message ?? 'Delete failed. Check your connection and try again.'
    throw new ApiError(message, code)
  }
}

/**
 * The structured result returned by POST /api/deadlines/parse (NL-02).
 * Matches the server response shape defined in Plan 02.
 */
export interface ParsedDeadlineResult {
  caseLabel: string
  typeId: number
  date: string
  description: string | null
}

/**
 * POST /api/deadlines/parse — parse free-text into a structured deadline (NL-02).
 * Returns the parsed shape on 200; throws ApiError with `code` on 4xx/5xx so
 * CommandPaletteShell can branch on err.code === 'parser_unconfigured' / 'parser_timeout' / 'parse_failed'.
 */
export async function parseDeadline(text: string): Promise<ParsedDeadlineResult> {
  const res = await fetch('/api/deadlines/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const code = body?.error?.code ?? 'unknown'
    const message = body?.error?.message ?? 'Parser unreachable. Try again.'
    throw new ApiError(message, code)
  }
  return res.json()
}

/** GET /api/settings: wallpaper theme + background image version. */
export async function getSettings(): Promise<AppSettings> {
  const res = await fetch('/api/settings')
  if (!res.ok) throw new Error('Failed to fetch settings')
  return res.json()
}

/** PUT /api/settings */
export async function updateSettings(patch: SettingsUpdate): Promise<AppSettings> {
  const res = await fetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? 'Could not save the setting. Try again.')
  }
  return res.json()
}

/** URL of the Glass theme background image; `version` busts caches after a new upload. */
export function wallpaperBackgroundUrl(version: number): string {
  return `/api/wallpaper-background?v=${version}`
}

/** PUT /api/wallpaper-background: upload the image file as the raw request body. */
export async function uploadWallpaperBackground(file: Blob): Promise<{ version: number }> {
  const res = await fetch('/api/wallpaper-background', {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? 'Could not upload the image. Try again.')
  }
  return res.json()
}

/** DELETE /api/wallpaper-background (a 404 means there was no image: fine). */
export async function deleteWallpaperBackground(): Promise<void> {
  const res = await fetch('/api/wallpaper-background', { method: 'DELETE' })
  if (!res.ok && res.status !== 404) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? 'Could not remove the image. Try again.')
  }
}

/** GET /api/cases: every case with open/total deadline counts and archive state. */
export async function getCases(): Promise<CaseSummary[]> {
  const res = await fetch('/api/cases')
  if (!res.ok) throw new Error('Failed to fetch cases')
  return res.json()
}

/** POST /api/cases/rename: rename a case, or merge it into another existing case. */
export async function renameCase(from: string, to: string): Promise<{ changed: number }> {
  const res = await fetch('/api/cases/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? 'Could not rename the case. Try again.')
  }
  return res.json()
}

/** PUT /api/cases/archive */
export async function setCaseArchived(caseLabel: string, archived: boolean): Promise<void> {
  const res = await fetch('/api/cases/archive', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseLabel, archived }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? 'Could not update the case. Try again.')
  }
}

/** POST /api/deadlines/extract: propose deadlines found in a longer text (nothing is saved). */
export async function extractDeadlines(text: string, caseLabel: string | null): Promise<{ proposals: DeadlineProposal[] }> {
  const res = await fetch('/api/deadlines/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, caseLabel }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? 'Could not read the text. Try again.')
  }
  return res.json()
}

/** POST /api/deadlines/bulk: save reviewed deadlines, all or nothing. */
export async function createDeadlinesBulk(deadlines: DeadlineCreate[]): Promise<{ created: number }> {
  const res = await fetch('/api/deadlines/bulk', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deadlines }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? 'Could not save the deadlines. Nothing was saved.')
  }
  return res.json()
}

/** GET /api/email-imports: emailed orders waiting for review. */
export async function getEmailInbox(): Promise<EmailInbox> {
  const res = await fetch('/api/email-imports')
  if (!res.ok) throw new Error('Failed to fetch the inbox')
  return res.json()
}

/** POST /api/email-imports/check: check the mailbox now. */
export async function checkEmailInbox(): Promise<EmailInbox> {
  const res = await fetch('/api/email-imports/check', { method: 'POST' })
  if (!res.ok) throw new Error('Could not check the mailbox. Try again.')
  return res.json()
}

/** POST /api/email-imports/:id/accept: save reviewed deadlines and mark the email done. */
export async function acceptEmailImport(id: number, deadlines: DeadlineCreate[]): Promise<{ created: number }> {
  const res = await fetch(`/api/email-imports/${id}/accept`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ deadlines }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? 'Could not save the deadlines. Nothing was saved.')
  }
  return res.json()
}

/** POST /api/email-imports/:id/dismiss */
export async function dismissEmailImport(id: number): Promise<void> {
  const res = await fetch(`/api/email-imports/${id}/dismiss`, { method: 'POST' })
  if (!res.ok && res.status !== 404) throw new Error('Could not dismiss the email. Try again.')
}

export interface DisplayMonitor { id: string; left: number; top: number; width: number; height: number; scale: number; primary: boolean }
export interface DisplaysInfo {
  monitors: DisplayMonitor[]
  chosen: string
  target: { monitorId: string | null; logicalWidth: number; logicalHeight: number; deviceScaleFactor: number }
}

/** GET /api/displays: connected monitors and what the wallpaper renders for. */
export async function getDisplays(refresh = false): Promise<DisplaysInfo> {
  const res = await fetch(`/api/displays${refresh ? '?refresh=1' : ''}`)
  if (!res.ok) throw new Error('Failed to detect monitors')
  return res.json()
}

export type ConfigKey =
  | 'TZ' | 'LLM_PROVIDER' | 'OPENAI_API_KEY' | 'OPENAI_MODEL' | 'ANTHROPIC_API_KEY'
  | 'SMTP_USER' | 'SMTP_PASS' | 'SMTP_HOST' | 'SMTP_PORT' | 'IMAP_HOST' | 'IMAP_PORT'
  | 'EMAIL_DIGEST_ENABLED' | 'SMTP_TO' | 'SMTP_FROM'
  | 'EMAIL_IMPORT_ENABLED' | 'EMAIL_IMPORT_ADDRESS' | 'EMAIL_IMPORT_ALLOWED_SENDERS'
  | 'WALLPAPER_ENABLED'

/** value is null for secrets (only `set` is reported). source: saved here, from .env.local, or not set. */
export interface ConfigField { value: string | null; set: boolean; source: 'app' | 'env' | 'unset' }
export interface AppConfig {
  fields: Record<ConfigKey, ConfigField>
  defaultTimeZone: string
  status: {
    ai: { provider: 'openai' | 'anthropic'; configured: boolean }
    digest: { state: 'off' | 'on' | 'error'; message: string | null }
    emailImport: { enabled: boolean; lastCheck: { at: string; ok: boolean; error: string | null } | null }
    wallpaper: { running: boolean }
  }
}

export class ConfigSaveError extends Error {
  constructor(message: string, readonly fields: Partial<Record<ConfigKey, string>>) { super(message) }
}

/** GET /api/config: Settings > Setup values and service status. */
export async function getConfig(): Promise<AppConfig> {
  const res = await fetch('/api/config')
  if (!res.ok) throw new Error('Failed to load setup')
  return res.json()
}

/** PUT /api/config: save some values ('' = not set). Throws ConfigSaveError with per-field messages. */
export async function saveConfig(values: Partial<Record<ConfigKey, string>>): Promise<AppConfig> {
  const res = await fetch('/api/config', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ values }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ConfigSaveError(body?.error?.message ?? 'Could not save. Try again.', body?.error?.fields ?? {})
  }
  return res.json()
}
