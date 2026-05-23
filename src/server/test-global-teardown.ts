/**
 * Vitest global teardown: remove per-worker test SQLite DB files and the
 * backups-test directory left behind after each test run.
 *
 * Without cleanup, every `npm test` invocation accumulates additional
 * deadlines-test-${VITEST_POOL_ID}.db files in data/ indefinitely —
 * causing disk pressure on CI and making it hard to distinguish test
 * artifacts from real failures.
 *
 * Registered via vitest.config.ts -> test.globalSetup.
 */
import fs from 'node:fs'
import path from 'node:path'

export async function teardown(): Promise<void> {
  const dataDir = path.join(process.cwd(), 'data')

  if (!fs.existsSync(dataDir)) return

  // Remove per-worker test DB files: deadlines-test-*.db and deadlines-test-*.db-shm / *.db-wal
  const testDbPattern = /^deadlines-test-.+\.db(-shm|-wal)?$/
  for (const file of fs.readdirSync(dataDir)) {
    if (testDbPattern.test(file)) {
      try {
        fs.unlinkSync(path.join(dataDir, file))
      } catch {
        // Best-effort: a worker may still hold the file open; ignore the error.
      }
    }
  }

  // Remove the backups-test directory and all its contents
  const backupsTestDir = path.join(dataDir, 'backups-test')
  if (fs.existsSync(backupsTestDir)) {
    try {
      fs.rmSync(backupsTestDir, { recursive: true, force: true })
    } catch {
      // Best-effort cleanup.
    }
  }
}
