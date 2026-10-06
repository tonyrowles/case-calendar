// SAFE-03: All date construction uses parseLocalDate (local-noon Date) — never new Date(isoString).
// Pure render functions for the email digest worker — no SMTP, no DB, no side effects.
import { parseLocalDate, toISODateString } from '../../shared/lib/date.js'
import { format } from 'date-fns'

// ─────────────────────────────────────────────────────────────────────────────
// Exported types
// ─────────────────────────────────────────────────────────────────────────────

export interface DigestDeadline {
  id: number
  date: string                    // 'YYYY-MM-DD' ISO date string
  caseLabel: string
  typeName: string
  typeColor: string               // hex string e.g. '#1D4ED8' — from deadline_types.color
  description: string | null
  completedAt: string | null      // ISO timestamp or null
}

/** The next 14 days from today, by date. No past/overdue section: like the list and the
 *  wallpaper, the digest shows what is coming up, not a task backlog. */
export interface DigestData {
  grouped: { date: string; deadlines: DigestDeadline[] }[]  // date ascending; deadlines sorted by caseLabel within date
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Add `days` calendar days to an ISO date string.
 * Uses parseLocalDate (local-noon) to dodge DST off-by-one bugs.
 * SAFE-03 compliant — never calls new Date(isoString).
 */
function addDaysIso(isoDate: string, days: number): string {
  const d = parseLocalDate(isoDate)
  if (!d) throw new Error(`Invalid ISO date: ${isoDate}`)
  d.setDate(d.getDate() + days)
  return toISODateString(d)
}

/**
 * HTML-escape user-provided strings for safe interpolation into HTML email.
 * & must be replaced FIRST before other replacements to avoid double-escaping.
 * T-10-XSS mitigation: applied to caseLabel, typeName, description in renderHTML.
 */
function escHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')      // & FIRST — must precede other replacements
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Format an ISO date string as "Weekday, Month D" for display.
 * T-10-DATE mitigation: parseLocalDate returns null for invalid dates;
 * falls back to the raw ISO string rather than throwing.
 * SAFE-03 compliant — never calls new Date(isoDate).
 */
function formatDateHeader(isoDate: string): string {
  const d = parseLocalDate(isoDate)
  if (!d) return isoDate  // defensive fallback — invalid dates should never reach here
  return format(d, 'EEEE, MMMM d')
}

/**
 * Format a single deadline line for plain-text output.
 * T-10-EMPTYDESC mitigation: description appended only when non-empty.
 */
function formatLine(d: DigestDeadline): string {
  const desc = d.description && d.description.length > 0 ? ` — ${d.description}` : ''
  return `[${d.date}] ${d.caseLabel} — ${d.typeName}${desc}`
}

/**
 * Build a single deadline row for HTML email output.
 * Applies escHtml to all user-provided fields.
 * typeColor is validated at render time: must match /^#[0-9A-Fa-f]{6}$/ or falls back to #6b7280.
 * Defense-in-depth: protects against DB values that bypassed Zod validation at write time.
 */
function rowTemplate(d: DigestDeadline): string {
  const safeColor = /^#[0-9A-Fa-f]{6}$/.test(d.typeColor) ? d.typeColor : '#6b7280'
  const descSpan =
    d.description && d.description.length > 0
      ? `<span style="color:#6b7280;font-size:13px;margin-left:6px;">${escHtml(d.description)}</span>`
      : ''
  return (
    `<tr><td style="padding:10px 24px;border-bottom:1px solid #e5e7eb;">` +
    `<strong>${escHtml(d.caseLabel)}</strong>` +
    `<span style="background:${safeColor};color:#fff;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;text-transform:uppercase;margin-left:6px;">${escHtml(d.typeName)}</span>` +
    `${descSpan}` +
    `</td></tr>`
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Exported pure functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Filter and group deadlines for the email digest.
 *
 * Rules:
 * - Excludes deadlines where completedAt !== null, and anything before today.
 * - grouped: date >= todayStr AND date <= todayStr+14, grouped by date ASC,
 *   deadlines within each date sorted by caseLabel ASC (localeCompare).
 */
export function filterDigest(deadlines: DigestDeadline[], todayStr: string): DigestData {
  const windowEnd = addDaysIso(todayStr, 14)

  // Exclude completed
  const active = deadlines.filter(d => d.completedAt === null)

  const inWindow = active.filter(d => d.date >= todayStr && d.date <= windowEnd)

  // Group in-window by date, dates ASC
  const dateMap = new Map<string, DigestDeadline[]>()
  for (const d of inWindow) {
    if (!dateMap.has(d.date)) dateMap.set(d.date, [])
    dateMap.get(d.date)!.push(d)
  }

  // Sort deadlines within each date by caseLabel ASC (locale-aware)
  for (const group of dateMap.values()) {
    group.sort((a, b) => a.caseLabel.localeCompare(b.caseLabel))
  }

  // Collect and sort groups by date ASC
  const grouped = Array.from(dateMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, deadlines]) => ({ date, deadlines }))

  return { grouped }
}

/**
 * Build the email subject line.
 * count === 0 → All clear; count === 1 → singular; count >= 2 → plural.
 */
export function buildSubject(data: DigestData): string {
  const count = data.grouped.reduce((s, g) => s + g.deadlines.length, 0)
  if (count === 0) return 'Case Calendar digest — All clear in next 14 days'
  if (count === 1) return 'Case Calendar digest — 1 deadline in next 14 days'
  return `Case Calendar digest — ${count} deadlines in next 14 days`
}

/**
 * Render the plain-text email body.
 *
 * Layout:
 *   === Weekday, Month D ===
 *   [YYYY-MM-DD] Case — Type
 *   ...
 *
 * Empty data: single line "No deadlines in the next 14 days."
 */
export function renderPlainText(data: DigestData): string {
  if (data.grouped.length === 0) {
    return 'No deadlines in the next 14 days.'
  }

  const lines: string[] = []

  for (const group of data.grouped) {
    lines.push(`=== ${formatDateHeader(group.date)} ===`)
    for (const d of group.deadlines) {
      lines.push(formatLine(d))
    }
    lines.push('')  // blank separator
  }

  // Remove trailing blank line
  while (lines.length > 0 && lines[lines.length - 1] === '') {
    lines.pop()
  }

  return lines.join('\n')
}

/**
 * Render the HTML email body.
 *
 * - Single 600px-wide outer table, all inline styles.
 * - No <style> tag — Outlook strips <head> CSS.
 * - User-provided strings (caseLabel, typeName, description) are HTML-escaped via escHtml.
 * - typeColor used verbatim (DB-validated hex — T-10-CSS accepted risk).
 */
export function renderHTML(data: DigestData): string {
  const isEmpty = data.grouped.length === 0

  const header =
    `<tr><td style="background:#1e3a5f;color:#fff;padding:16px 24px;">` +
    `<strong>Case Calendar</strong> — Next 14 Days` +
    `</td></tr>`

  let body = ''

  if (isEmpty) {
    body =
      `<tr><td style="padding:16px 24px;color:#374151;">` +
      `No deadlines in the next 14 days.` +
      `</td></tr>`
  } else {
    for (const group of data.grouped) {
      const headerText = formatDateHeader(group.date).toUpperCase()
      body +=
        `<tr><td style="background:#f0f4f8;color:#374151;padding:8px 24px;font-weight:600;font-size:12px;">` +
        `${headerText}` +
        `</td></tr>`
      for (const d of group.deadlines) {
        body += rowTemplate(d)
      }
    }
  }

  return (
    `<table border="0" cellpadding="0" cellspacing="0" role="presentation" ` +
    `style="width:600px;border-collapse:collapse;font-family:Arial,Helvetica,sans-serif;font-size:14px;">` +
    header +
    body +
    `</table>`
  )
}
