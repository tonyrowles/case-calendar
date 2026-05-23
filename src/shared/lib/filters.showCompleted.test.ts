import { describe, it, expect } from 'vitest'
import { applyFilters } from './filters.js'
import type { Filters } from './filters.js'

// CRUD-05/06: applyFilters honors showCompleted flag

type TestDeadline = {
  date: string
  caseLabel: string
  typeId: number
  completedAt: string | null
}

const TODAY = '2026-05-23'

function makeFilters(overrides: Partial<Filters> = {}): Filters {
  return {
    case: null,
    typeIds: [],
    range: 'all',
    showCompleted: false,
    ...overrides,
  }
}

const active: TestDeadline = {
  date: '2026-06-15',
  caseLabel: 'Smith v. Jones',
  typeId: 1,
  completedAt: null,
}

const completed: TestDeadline = {
  date: '2026-06-15',
  caseLabel: 'Smith v. Jones',
  typeId: 1,
  completedAt: '2026-05-20T12:00:00Z',
}

const completedToday: TestDeadline = {
  date: TODAY,
  caseLabel: 'Garcia v. City',
  typeId: 2,
  completedAt: '2026-05-23T08:00:00Z',
}

describe('applyFilters — showCompleted behavior (CRUD-05, CRUD-06)', () => {
  it('showCompleted=false excludes deadlines where completedAt is not null', () => {
    const result = applyFilters([active, completed], makeFilters({ showCompleted: false }), TODAY)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(active)
  })

  it('showCompleted=true keeps deadlines regardless of completedAt value', () => {
    const result = applyFilters([active, completed], makeFilters({ showCompleted: true }), TODAY)
    expect(result).toHaveLength(2)
    expect(result).toContain(active)
    expect(result).toContain(completed)
  })

  it('showCompleted filter is independent of case/type/range filters (intersection)', () => {
    const deadlines = [active, completed, completedToday]
    // showCompleted=true + range=today → only items on today's date
    const result = applyFilters(deadlines, makeFilters({ showCompleted: true, range: 'today' }), TODAY)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(completedToday)
  })

  it('showCompleted=true + range=all: includes both completed and active', () => {
    const result = applyFilters([active, completed], makeFilters({ showCompleted: true, range: 'all' }), TODAY)
    expect(result).toHaveLength(2)
  })

  it('showCompleted=false + range=all: still excludes completed', () => {
    const result = applyFilters([active, completed], makeFilters({ showCompleted: false, range: 'all' }), TODAY)
    expect(result).toHaveLength(1)
    expect(result[0]).toBe(active)
  })

  it('typeIds filter intersects with showCompleted correctly', () => {
    const completedType2: TestDeadline = {
      date: '2026-06-15',
      caseLabel: 'Lee v. Corp',
      typeId: 2,
      completedAt: '2026-05-23T08:00:00Z',
    }
    const activeType2: TestDeadline = {
      date: '2026-06-15',
      caseLabel: 'Lee v. Corp',
      typeId: 2,
      completedAt: null,
    }
    // showCompleted=true + typeIds=[2] → only typeId=2 deadlines (both active and completed)
    const result = applyFilters(
      [active, completed, completedType2, activeType2],
      makeFilters({ showCompleted: true, typeIds: [2] }),
      TODAY
    )
    expect(result).toHaveLength(2)
    expect(result).toContain(completedType2)
    expect(result).toContain(activeType2)
  })
})
