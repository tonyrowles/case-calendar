import { describe, it, expect, vi, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { verifyPragmas } from './db-init.js'

describe('verifyPragmas', () => {
  it('does not throw when all PRAGMAs are set correctly (file-based DB required for WAL)', () => {
    // WAL journal mode requires a file-based database (not :memory:)
    const tmpFile = path.join(os.tmpdir(), `pragma-test-${Date.now()}.db`)
    const db = new Database(tmpFile)
    try {
      // Should not throw or exit
      expect(() => verifyPragmas(db)).not.toThrow()
    } finally {
      db.close()
      fs.unlinkSync(tmpFile)
    }
  })

  it('calls process.exit(1) on PRAGMA mismatch', () => {
    const db = new Database(':memory:')
    // For in-memory DB, WAL is unsupported so journal_mode stays 'memory'.
    // Set other PRAGMAs but leave journal_mode as-is — this guarantees a mismatch.
    db.pragma('synchronous = NORMAL')
    db.pragma('foreign_keys = ON')
    db.pragma('busy_timeout = 5000')
    // journal_mode will be 'memory' (not 'wal'), causing mismatch

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code?: string | number | null | undefined) => {
      throw new Error('process.exit called')
    })

    expect(() => verifyPragmas(db)).toThrow('process.exit called')
    expect(exitSpy).toHaveBeenCalledWith(1)

    exitSpy.mockRestore()
    db.close()
  })

  it('synchronous comparison uses integer 1, not string NORMAL', () => {
    const db = new Database(':memory:')
    db.pragma('synchronous = NORMAL')
    const actual = db.pragma('synchronous', { simple: true })
    expect(actual).toBe(1)  // Must be integer 1, NOT 'NORMAL'
    db.close()
  })
})
