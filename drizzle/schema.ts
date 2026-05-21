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
