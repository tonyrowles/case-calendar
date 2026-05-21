import Database, { type Database as DatabaseType } from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../../drizzle/schema.js'
import path from 'node:path'
import fs from 'node:fs'
import { verifyPragmas, runStartupBackup } from './db-init.js'

// Re-export so callers can import from db.ts (plan interface requirement)
export { verifyPragmas, runStartupBackup }

// Database file: data/deadlines.db (relative to process.cwd())
const DB_PATH = path.join(process.cwd(), 'data', 'deadlines.db')
export const BACKUP_DIR = path.join(process.cwd(), 'data', 'backups')

// Ensure directories exist
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
fs.mkdirSync(BACKUP_DIR, { recursive: true })

// Module-level side effects: open DB and run startup tasks
export const sqlite: DatabaseType = new Database(DB_PATH)

verifyPragmas(sqlite)
runStartupBackup(sqlite, BACKUP_DIR)

export const db = drizzle(sqlite, { schema })
