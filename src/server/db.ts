import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from '../../drizzle/schema.js'
import path from 'node:path'
import fs from 'node:fs'

// Database file: data/deadlines.db (relative to process.cwd())
const DB_PATH = path.join(process.cwd(), 'data', 'deadlines.db')

// Ensure data directory exists
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })

export const sqlite = new Database(DB_PATH)

// SAFE-04: Set PRAGMAs for safety and performance.
// Verification (fail-fast on mismatch) is deferred to Plan 01-02.
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('synchronous = NORMAL')
sqlite.pragma('foreign_keys = ON')
sqlite.pragma('busy_timeout = 5000')

console.log(`DB opened at ${DB_PATH}`)

export const db = drizzle(sqlite, { schema })
