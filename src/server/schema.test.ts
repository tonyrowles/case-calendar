/**
 * Tests for schema introspection — DATA-01, DATA-02, DATA-03, DATA-04
 *
 * Uses PRAGMA table_info / PRAGMA foreign_key_list / PRAGMA index_list
 * against the real data/deadlines.db (post drizzle-kit push from Task 1).
 *
 * NOTE: Drizzle by default uses camelCase column names in SQLite
 * (no explicit .name() mapping in schema.ts), so we verify the actual
 * column names as stored in the database.
 */
import { describe, it, expect } from 'vitest'
import { sqlite } from './db.js'

type ColumnInfo = {
  cid: number
  name: string
  type: string
  notnull: number
  dflt_value: string | null
  pk: number
}

type ForeignKeyRow = {
  id: number
  seq: number
  table: string
  from: string
  to: string
  on_update: string
  on_delete: string
  match: string
}

type IndexRow = {
  seq: number
  name: string
  unique: number
  origin: string
  partial: number
}

type IndexInfoRow = {
  seqno: number
  cid: number
  name: string
}

describe('deadlines table schema (DATA-01, DATA-02, DATA-03)', () => {
  it('has all required columns', () => {
    const columns = sqlite.pragma('table_info(deadlines)') as ColumnInfo[]
    const names = columns.map(c => c.name)

    // DATA-01: required fields
    expect(names).toContain('id')
    expect(names).toContain('date')
    expect(names).toContain('caseLabel')   // Drizzle camelCase (DATA-03 denormalized label)
    expect(names).toContain('typeId')      // FK to deadline_types (DATA-01)
    expect(names).toContain('description')
    expect(names).toContain('completedAt') // nullable (DATA-01)
    expect(names).toContain('createdAt')
    expect(names).toContain('updatedAt')
    expect(names).toHaveLength(8)
  })

  it('date column is TEXT type (DATA-02 — never INTEGER timestamps)', () => {
    const columns = sqlite.pragma('table_info(deadlines)') as ColumnInfo[]
    const dateCol = columns.find(c => c.name === 'date')
    expect(dateCol).toBeDefined()
    // DATA-02: dates must be stored as TEXT (ISO 8601 strings), never INTEGER
    expect(dateCol!.type.toLowerCase()).toBe('text')
  })

  it('completedAt column is TEXT and nullable (DATA-01)', () => {
    const columns = sqlite.pragma('table_info(deadlines)') as ColumnInfo[]
    const completedAtCol = columns.find(c => c.name === 'completedAt')
    expect(completedAtCol).toBeDefined()
    expect(completedAtCol!.type.toLowerCase()).toBe('text')
    expect(completedAtCol!.notnull).toBe(0) // nullable
  })

  it('caseLabel is a denormalized string column — no cases table (DATA-03)', () => {
    const columns = sqlite.pragma('table_info(deadlines)') as ColumnInfo[]
    const caseLabelCol = columns.find(c => c.name === 'caseLabel')
    expect(caseLabelCol).toBeDefined()
    expect(caseLabelCol!.type.toLowerCase()).toBe('text')
    expect(caseLabelCol!.notnull).toBe(1) // required field

    // Verify there is no 'cases' table (DATA-03: denormalized, no separate table)
    const tables = sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='cases'"
    ).all()
    expect(tables).toHaveLength(0)
  })

  it('deadlines.typeId references deadline_types.id (DATA-04 FK)', () => {
    const fkList = sqlite.pragma('foreign_key_list(deadlines)') as ForeignKeyRow[]
    expect(fkList.length).toBeGreaterThan(0)

    const typeIdFk = fkList.find(fk => fk.from === 'typeId')
    expect(typeIdFk).toBeDefined()
    expect(typeIdFk!.table).toBe('deadline_types')
    expect(typeIdFk!.to).toBe('id')
  })
})

describe('deadline_types table schema (DATA-04)', () => {
  it('has required columns: id, name, color, createdAt', () => {
    const columns = sqlite.pragma('table_info(deadline_types)') as ColumnInfo[]
    const names = columns.map(c => c.name)

    expect(names).toContain('id')
    expect(names).toContain('name')
    expect(names).toContain('color')
    expect(names).toContain('createdAt')
    expect(names).toHaveLength(4)
  })

  it('name column has UNIQUE constraint', () => {
    const indexes = sqlite.pragma('index_list(deadline_types)') as IndexRow[]
    const uniqueIndexes = indexes.filter(idx => idx.unique === 1)
    expect(uniqueIndexes.length).toBeGreaterThan(0)

    // Find which unique index covers the 'name' column
    let nameHasUniqueIndex = false
    for (const idx of uniqueIndexes) {
      const info = sqlite.pragma(`index_info(${idx.name})`) as IndexInfoRow[]
      if (info.some(col => col.name === 'name')) {
        nameHasUniqueIndex = true
        break
      }
    }
    expect(nameHasUniqueIndex).toBe(true)
  })

  it('color column is TEXT type', () => {
    const columns = sqlite.pragma('table_info(deadline_types)') as ColumnInfo[]
    const colorCol = columns.find(c => c.name === 'color')
    expect(colorCol).toBeDefined()
    expect(colorCol!.type.toLowerCase()).toBe('text')
  })
})
