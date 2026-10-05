import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import { getTableConfig, SQLiteTable } from 'drizzle-orm/sqlite-core'
import * as schema from '../../drizzle/schema.js'
import { ensureSchema } from './schema-init.js'

const tables = Object.values(schema).filter((t): t is SQLiteTable => t instanceof SQLiteTable)

describe('ensureSchema', () => {
  it('creates every table and column of drizzle/schema.ts on an empty database', () => {
    const db = new Database(':memory:')
    ensureSchema(db)
    expect(tables.length).toBeGreaterThanOrEqual(6)
    for (const t of tables) {
      const cfg = getTableConfig(t)
      const cols = db.prepare(`PRAGMA table_info(\`${cfg.name}\`)`).all() as Array<{ name: string; notnull: number }>
      expect(cols.map(c => c.name).sort(), cfg.name).toEqual(cfg.columns.map(c => c.name).sort())
      for (const c of cfg.columns) {
        const col = cols.find(x => x.name === c.name)!
        expect(!!col.notnull || c.primary, `${cfg.name}.${c.name} notNull`).toBe(c.notNull)
      }
    }
  })

  it('is safe to run on an existing database (no data lost)', () => {
    const db = new Database(':memory:')
    ensureSchema(db)
    db.prepare("INSERT INTO app_settings (key, value) VALUES ('k', 'v')").run()
    ensureSchema(db)
    expect(db.prepare('SELECT value FROM app_settings').get()).toEqual({ value: 'v' })
  })
})
