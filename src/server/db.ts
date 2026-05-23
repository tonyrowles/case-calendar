import Database, { type Database as DatabaseType } from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../../drizzle/schema.js'
import path from 'node:path'
import fs from 'node:fs'
import { verifyPragmas, runStartupBackup, runStartupTriggers } from './db-init.js'

// Re-export so callers can import from db.ts (plan interface requirement)
export { verifyPragmas, runStartupBackup, runStartupTriggers }

// Database file: data/deadlines.db (relative to process.cwd())
// In test runs (Vitest sets VITEST=true) use a separate test DB so npm test
// never touches the production database file.
const IS_TEST = process.env.VITEST === 'true'
// Per-worker test DB suffix so parallel test files (each in its own Vitest worker)
// never race on the same SQLite file. VITEST_POOL_ID is exposed for both 'threads'
// and 'forks' pools; fallback to 'main' for the orchestrator/setup process.
const TEST_WORKER_ID = process.env.VITEST_POOL_ID || 'main'
const DB_PATH = IS_TEST
  ? path.join(process.cwd(), 'data', `deadlines-test-${TEST_WORKER_ID}.db`)
  : path.join(process.cwd(), 'data', 'deadlines.db')
export const BACKUP_DIR = IS_TEST
  ? path.join(process.cwd(), 'data', 'backups-test')
  : path.join(process.cwd(), 'data', 'backups')

// Ensure directories exist
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
fs.mkdirSync(BACKUP_DIR, { recursive: true })

// Module-level side effects: open DB and run startup tasks
export const sqlite: DatabaseType = new Database(DB_PATH)

verifyPragmas(sqlite)
runStartupBackup(sqlite, BACKUP_DIR)
runStartupTriggers(sqlite)

export const db = drizzle(sqlite, { schema })
