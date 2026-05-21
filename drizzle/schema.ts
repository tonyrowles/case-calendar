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
