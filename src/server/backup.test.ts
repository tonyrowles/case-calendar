import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { runStartupBackup } from './db-init.js'

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'))
}

describe('runStartupBackup', () => {
  it('first call writes backup file and logs path', () => {
    const tmpDir = makeTempDir()
    const db = new Database(':memory:')
    // Ensure tables exist for VACUUM (even empty is fine)
    db.pragma('journal_mode = WAL')

    runStartupBackup(db, tmpDir)

    const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.db'))
    expect(files).toHaveLength(1)
    expect(files[0]).toMatch(/^deadlines-\d{4}-\d{2}-\d{2}\.db$/)

    db.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('same-day second call is a no-op (file mtime unchanged)', () => {
    const tmpDir = makeTempDir()
    const db = new Database(':memory:')
    db.pragma('journal_mode = WAL')

    runStartupBackup(db, tmpDir)

    const files = fs.readdirSync(tmpDir).filter(f => f.endsWith('.db'))
    const backupPath = path.join(tmpDir, files[0])
    const mtimeBefore = fs.statSync(backupPath).mtimeMs

    // Second call on the same day
    runStartupBackup(db, tmpDir)

    const mtimeAfter = fs.statSync(backupPath).mtimeMs
    expect(mtimeAfter).toBe(mtimeBefore)

    db.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('file older than 30 days is pruned', () => {
    const tmpDir = makeTempDir()
    const db = new Database(':memory:')
    db.pragma('journal_mode = WAL')

    // Create a synthetic old backup file (60 days ago)
    const oldFile = path.join(tmpDir, 'deadlines-2020-01-01.db')
    fs.writeFileSync(oldFile, '')
    const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000
    const t = new Date(sixtyDaysAgo)
    fs.utimesSync(oldFile, t, t)

    runStartupBackup(db, tmpDir)

    expect(fs.existsSync(oldFile)).toBe(false)

    db.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('file within 30 days is retained', () => {
    const tmpDir = makeTempDir()
    const db = new Database(':memory:')
    db.pragma('journal_mode = WAL')

    // Create a synthetic recent backup file (5 days ago)
    const recentFile = path.join(tmpDir, 'deadlines-2026-05-16.db')
    fs.writeFileSync(recentFile, '')
    const fiveDaysAgo = Date.now() - 5 * 24 * 60 * 60 * 1000
    const t = new Date(fiveDaysAgo)
    fs.utimesSync(recentFile, t, t)

    runStartupBackup(db, tmpDir)

    expect(fs.existsSync(recentFile)).toBe(true)

    db.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })
})
