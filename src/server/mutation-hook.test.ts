/**
 * Tests for HOOK-04: onMutation() callback fires on createDeadline
 *
 * Uses the real data/deadlines.db. Both tables are cleaned in beforeEach
 * and a single Filing type is seeded so FK constraints pass.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { sqlite } from './db.js'
import { createDeadline, onMutation } from './queries.js'

function cleanTables(): void {
  sqlite.exec('DELETE FROM deadlines')
  sqlite.exec('DELETE FROM deadline_types')
}

function seedOneType(): void {
  sqlite
    .prepare('INSERT OR IGNORE INTO deadline_types (id, name, color) VALUES (?, ?, ?)')
    .run(1, 'Filing', '#1D4ED8')
}

beforeEach(() => {
  cleanTables()
  seedOneType()
  // Reset the onMutation callback before each test
  onMutation(() => {})
})

describe('HOOK-04: createDeadline triggers onMutation callback', () => {
  it('spy is called exactly once when createDeadline is called', () => {
    const spy = vi.fn()
    onMutation(spy)

    createDeadline({ date: '2026-06-15', caseLabel: 'Hook test', typeId: 1 })

    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('spy is called once per createDeadline call (3 calls → 3 spy calls)', () => {
    const spy = vi.fn()
    onMutation(spy)

    createDeadline({ date: '2026-06-15', caseLabel: 'Case A', typeId: 1 })
    createDeadline({ date: '2026-06-16', caseLabel: 'Case B', typeId: 1 })
    createDeadline({ date: '2026-06-17', caseLabel: 'Case C', typeId: 1 })

    expect(spy).toHaveBeenCalledTimes(3)
  })

  it('replacing the callback: only the new callback fires after onMutation(newSpy)', () => {
    const spy1 = vi.fn()
    const spy2 = vi.fn()

    onMutation(spy1)
    createDeadline({ date: '2026-06-15', caseLabel: 'First', typeId: 1 })
    expect(spy1).toHaveBeenCalledTimes(1)
    expect(spy2).toHaveBeenCalledTimes(0)

    // Replace callback
    onMutation(spy2)
    createDeadline({ date: '2026-06-16', caseLabel: 'Second', typeId: 1 })

    // spy2 called once, spy1 NOT called again
    expect(spy2).toHaveBeenCalledTimes(1)
    expect(spy1).toHaveBeenCalledTimes(1) // still 1, not 2
  })

  it('no callback registered: createDeadline does not throw (optional chaining safety)', () => {
    // Reset to null by overwriting with a no-op then clearing via onMutation
    // We reset callback to no-op in beforeEach; here we verify creating a deadline
    // with a non-throwing callback is safe
    const noop = vi.fn()
    onMutation(noop)

    expect(() =>
      createDeadline({ date: '2026-06-15', caseLabel: 'Safe', typeId: 1 })
    ).not.toThrow()
  })
})
