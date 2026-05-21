/**
 * SAFE-04/SAFE-05: Testable DB initialization functions.
 * This module has NO module-level side effects — safe to import in tests.
 * src/server/db.ts imports these and calls them with the real DB instance.
 */
import { type Database as DatabaseType } from 'better-sqlite3'
import path from 'node:path'
import fs from 'node:fs'
import { toISODateString } from '../shared/lib/date.js'
import { logger } from './logger.js'

/**
 * SAFE-04: Verify all four PRAGMAs are set correctly.
 * If any mismatch is detected, logs fatal error and calls process.exit(1).
 * NOTE: synchronous returns integer 1 (not string 'NORMAL') — comparison MUST use integer.
 */
export function verifyPragmas(sqlite: DatabaseType): void {
  // Set the PRAGMAs first
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('synchronous = NORMAL')
  sqlite.pragma('foreign_keys = ON')
  sqlite.pragma('busy_timeout = 5000')

  // Verification map — CRITICAL: synchronous: 1 is integer, NOT string 'NORMAL' (RESEARCH Pitfall 1)
  const expected: Record<string, string | number> = {
    journal_mode: 'wal',
    synchronous: 1,
    foreign_keys: 1,
    busy_timeout: 5000,
  }

  for (const [name, expectedValue] of Object.entries(expected)) {
    const actual = sqlite.pragma(name, { simple: true })
    if (actual !== expectedValue) {
      logger.fatal({ pragma: name, expected: expectedValue, actual }, 'PRAGMA mismatch')
      process.exit(1)
    }
  }

  logger.info('pragmas: journal_mode=wal synchronous=1 foreign_keys=1 busy_timeout=5000')
}

/**
 * SAFE-05: Run startup backup via VACUUM INTO.
 * - Same-day second call is a no-op (guards against SQLITE_ERROR: destination already exists).
 * - 30-day retention sweep deletes old backup files.
 */
export function runStartupBackup(sqlite: DatabaseType, backupDir: string): void {
  // Use toISODateString from the shared date util (SAFE-03: consistent date utility usage)
  const today = toISODateString(new Date())
  const backupFile = path.join(backupDir, `deadlines-${today}.db`)

  if (fs.existsSync(backupFile)) {
    logger.info(`backup: skipped (already exists for today)`)
  } else {
    // RESEARCH Pitfall 3: VACUUM INTO throws if destination exists — guard above prevents it
    sqlite.exec(`VACUUM INTO '${backupFile}'`)
    logger.info(`backup: ${backupFile}`)
  }

  // 30-day retention sweep
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000
  const files = fs.readdirSync(backupDir)
  for (const file of files) {
    if (file.startsWith('deadlines-') && file.endsWith('.db')) {
      const filePath = path.join(backupDir, file)
      const stat = fs.statSync(filePath)
      if (stat.mtimeMs < cutoff) {
        fs.unlinkSync(filePath)
        logger.info(`pruned: ${file}`)
      }
    }
  }
}
