import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'

export const deadlineTypes = sqliteTable('deadline_types', {
  id: integer({ mode: 'number' }).primaryKey({ autoIncrement: true }),
  name: text().notNull().unique(),
  color: text().notNull(),           // hex string e.g. '#1D4ED8'
  createdAt: text().notNull().default(sql`(CURRENT_TIMESTAMP)`),
})

export const deadlines = sqliteTable('deadlines', {
  id: integer({ mode: 'number' }).primaryKey({ autoIncrement: true }),
  date: text().notNull(),            // DATA-02: always 'YYYY-MM-DD', never Date object
  caseLabel: text().notNull(),       // DATA-03: denormalized string
  typeId: integer({ mode: 'number' }).notNull().references(() => deadlineTypes.id),
  description: text(),               // nullable
  completedAt: text(),               // DATA-01: nullable timestamp as TEXT
  createdAt: text().notNull().default(sql`(CURRENT_TIMESTAMP)`),
  updatedAt: text().notNull().default(sql`(CURRENT_TIMESTAMP)`),
})

/**
 * User-chosen case colors (overrides of the automatic per-case color). Cases are
 * free-text labels, so rows are keyed by the normalized label (caseColorKey in
 * src/shared/lib/case-colors.ts); caseLabel keeps the spelling it was set with.
 */
export const caseColors = sqliteTable('case_colors', {
  caseKey: text().primaryKey(),
  caseLabel: text().notNull(),
  color: text().notNull(),           // one of CASE_PALETTE
  updatedAt: text().notNull().default(sql`(CURRENT_TIMESTAMP)`),
})

/**
 * Archived (closed) cases: hidden from the case picker and case filter. Their deadlines
 * still show everywhere. Keyed like case_colors (normalized label).
 */
export const archivedCases = sqliteTable('archived_cases', {
  caseKey: text().primaryKey(),
  caseLabel: text().notNull(),
  archivedAt: text().notNull().default(sql`(CURRENT_TIMESTAMP)`),
})

/**
 * Emails sent to the import address (EMAIL_IMPORT_ADDRESS). One row per message, keyed
 * by Message-ID so a message is never processed twice.
 *   pending   - proposals extracted, waiting for the user to review (nothing saved yet)
 *   done      - the user added the reviewed deadlines
 *   dismissed - the user dismissed it
 *   rejected  - sender not allowed / not verified (never sent to the model)
 *   failed    - extraction failed (reason says why)
 */
export const emailImports = sqliteTable('email_imports', {
  id: integer({ mode: 'number' }).primaryKey({ autoIncrement: true }),
  messageId: text().notNull().unique(),
  fromAddress: text().notNull(),
  subject: text().notNull(),
  receivedAt: text().notNull(),       // ISO timestamp from the message Date header
  status: text().notNull(),
  reason: text(),
  proposals: text(),                  // JSON DeadlineProposal[] (pending/done)
  createdAt: text().notNull().default(sql`(CURRENT_TIMESTAMP)`),
})

/**
 * App settings as key/value rows (e.g. key 'wallpaperTheme'). Missing key = default.
 */
export const appSettings = sqliteTable('app_settings', {
  key: text().primaryKey(),
  value: text().notNull(),
  updatedAt: text().notNull().default(sql`(CURRENT_TIMESTAMP)`),
})

/**
 * WR-05: SQLite trigger to auto-update updatedAt on every UPDATE.
 * DEFAULT (CURRENT_TIMESTAMP) only fires on INSERT; without this trigger any
 * Phase 2+ edit endpoint that omits SET updatedAt would return a stale value.
 * Applied by db-init.ts at startup via runStartupTriggers().
 */
export const SET_DEADLINES_UPDATED_AT_TRIGGER = `
  CREATE TRIGGER IF NOT EXISTS set_deadlines_updated_at
  AFTER UPDATE ON deadlines
  FOR EACH ROW
  BEGIN
    UPDATE deadlines SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END
`
