/**
 * Vitest global setup: ensure the test database has the correct schema before
 * any tests run. This file is declared in vitest.config.ts -> test.setupFiles.
 *
 * The schema is applied via raw SQL matching drizzle/schema.ts so we don't
 * need migration files. CREATE TABLE IF NOT EXISTS makes this idempotent.
 */
import { sqlite } from './db.js'
import { ensureSchema } from './schema-init.js'

// Same schema the server creates on first run (db.ts already ran it; harmless to repeat)
ensureSchema(sqlite)

// Install the updatedAt trigger (idempotent: CREATE TRIGGER IF NOT EXISTS)
sqlite.exec(`
  CREATE TRIGGER IF NOT EXISTS set_deadlines_updated_at
  AFTER UPDATE ON deadlines
  FOR EACH ROW
  BEGIN
    UPDATE deadlines SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END
`)
