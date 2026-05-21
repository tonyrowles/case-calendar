/**
 * Vitest global setup: ensure the test database has the correct schema before
 * any tests run. This file is declared in vitest.config.ts -> test.setupFiles.
 *
 * The schema is applied via raw SQL matching drizzle/schema.ts so we don't
 * need migration files. CREATE TABLE IF NOT EXISTS makes this idempotent.
 */
import { sqlite } from './db.js'

// Create deadline_types table
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS deadline_types (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT    NOT NULL UNIQUE,
    color     TEXT    NOT NULL,
    createdAt TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP)
  )
`)

// Create deadlines table
sqlite.exec(`
  CREATE TABLE IF NOT EXISTS deadlines (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    date        TEXT    NOT NULL,
    caseLabel   TEXT    NOT NULL,
    typeId      INTEGER NOT NULL REFERENCES deadline_types(id),
    description TEXT,
    completedAt TEXT,
    createdAt   TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP),
    updatedAt   TEXT    NOT NULL DEFAULT (CURRENT_TIMESTAMP)
  )
`)

// Install the updatedAt trigger (idempotent: CREATE TRIGGER IF NOT EXISTS)
sqlite.exec(`
  CREATE TRIGGER IF NOT EXISTS set_deadlines_updated_at
  AFTER UPDATE ON deadlines
  FOR EACH ROW
  BEGIN
    UPDATE deadlines SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END
`)
