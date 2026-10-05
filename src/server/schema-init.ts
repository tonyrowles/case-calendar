/**
 * Create the database tables on first run. Developer checkouts historically used
 * `drizzle-kit push`; an installed copy has no drizzle-kit, so the server creates the
 * schema itself. The SQL is `drizzle-kit export` output for drizzle/schema.ts with
 * IF NOT EXISTS added, so an existing (pushed) database is left exactly as it is.
 * schema-init.test.ts checks every table and column in drizzle/schema.ts is covered.
 *
 * Adding a column later: add the ALTER TABLE ... ADD COLUMN here, guarded by a
 * PRAGMA table_info check, so existing installs pick it up on their next start.
 */
import type { Database as DatabaseType } from 'better-sqlite3'

const DDL = `
CREATE TABLE IF NOT EXISTS \`app_settings\` (
	\`key\` text PRIMARY KEY NOT NULL,
	\`value\` text NOT NULL,
	\`updatedAt\` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
CREATE TABLE IF NOT EXISTS \`archived_cases\` (
	\`caseKey\` text PRIMARY KEY NOT NULL,
	\`caseLabel\` text NOT NULL,
	\`archivedAt\` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
CREATE TABLE IF NOT EXISTS \`case_colors\` (
	\`caseKey\` text PRIMARY KEY NOT NULL,
	\`caseLabel\` text NOT NULL,
	\`color\` text NOT NULL,
	\`updatedAt\` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
CREATE TABLE IF NOT EXISTS \`deadline_types\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`name\` text NOT NULL,
	\`color\` text NOT NULL,
	\`createdAt\` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS \`deadline_types_name_unique\` ON \`deadline_types\` (\`name\`);
CREATE TABLE IF NOT EXISTS \`deadlines\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`date\` text NOT NULL,
	\`caseLabel\` text NOT NULL,
	\`typeId\` integer NOT NULL,
	\`description\` text,
	\`completedAt\` text,
	\`createdAt\` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	\`updatedAt\` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	FOREIGN KEY (\`typeId\`) REFERENCES \`deadline_types\`(\`id\`) ON UPDATE no action ON DELETE no action
);
CREATE TABLE IF NOT EXISTS \`email_imports\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`messageId\` text NOT NULL,
	\`fromAddress\` text NOT NULL,
	\`subject\` text NOT NULL,
	\`receivedAt\` text NOT NULL,
	\`status\` text NOT NULL,
	\`reason\` text,
	\`proposals\` text,
	\`createdAt\` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS \`email_imports_messageId_unique\` ON \`email_imports\` (\`messageId\`);
`

export function ensureSchema(sqlite: DatabaseType): void {
  sqlite.exec(DDL)
}
