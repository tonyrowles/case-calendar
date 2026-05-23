// @vitest-environment jsdom
// Wave 0 stub. Plan 03 Task 1 (mapping + popover + CSS) converts the M-series
// todos to live `it()`. Plan 03 Task 2 (FullCalendar integration) converts the C-series todos
// to live `it()`.
//
// The 3-arg signature for mapDeadlinesToEvents is LOCKED here:
//   mapDeadlinesToEvents(deadlines: Deadline[], todayStr: string, typesById: Map<number, DeadlineType>)
// Plan 03 implements against this signature without renegotiation.
import { describe, it, expect } from 'vitest'
import { mapDeadlinesToEvents } from './CalendarView.js'
import type { Deadline, DeadlineType } from '@/shared/schemas/deadline.js'

// Tiny test fixture builder
const TYPE_FILING: DeadlineType = { id: 1, name: 'Filing', color: '#1D4ED8', createdAt: '' }
const typesById = new Map([[1, TYPE_FILING]])

function makeDeadline(overrides: Partial<Deadline>): Deadline {
  return {
    id: 1,
    date: '2026-06-15',
    caseLabel: 'Smith v. Jones',
    typeId: 1,
    description: null,
    completedAt: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  }
}

describe('mapDeadlinesToEvents (SAFE-01, SAFE-02) — pure function, 3-arg signature: (deadlines, todayStr, typesById)', () => {
  it('M1: maps date \'2026-06-15\' to start \'2026-06-15\' verbatim (SAFE-01) — fixture: typesById Map with one type', () => {
    const deadlines = [makeDeadline({ date: '2026-06-15' })]
    const result = mapDeadlinesToEvents(deadlines, '2026-05-22', typesById)
    expect(result[0].start).toBe('2026-06-15')
    expect(result[0].allDay).toBe(true)
  })

  it('M2: maps DST spring-forward 2026-03-08 to start \'2026-03-08\' verbatim (SAFE-02)', () => {
    const deadlines = [makeDeadline({ date: '2026-03-08' })]
    const result = mapDeadlinesToEvents(deadlines, '2026-05-22', typesById)
    expect(result[0].start).toBe('2026-03-08')
  })

  it('M3: maps day-after spring-forward 2026-03-09 to start \'2026-03-09\' verbatim (SAFE-02)', () => {
    const deadlines = [makeDeadline({ date: '2026-03-09' })]
    const result = mapDeadlinesToEvents(deadlines, '2026-05-22', typesById)
    expect(result[0].start).toBe('2026-03-09')
  })

  it('M4: maps DST fall-back 2026-11-01 to start \'2026-11-01\' verbatim (SAFE-02)', () => {
    const deadlines = [makeDeadline({ date: '2026-11-01' })]
    const result = mapDeadlinesToEvents(deadlines, '2026-05-22', typesById)
    expect(result[0].start).toBe('2026-11-01')
  })

  it('M5: maps day-after fall-back 2026-11-02 to start \'2026-11-02\' verbatim (SAFE-02)', () => {
    const deadlines = [makeDeadline({ date: '2026-11-02' })]
    const result = mapDeadlinesToEvents(deadlines, '2026-05-22', typesById)
    expect(result[0].start).toBe('2026-11-02')
  })

  it('M6: filters out deadlines with completedAt !== null', () => {
    const completed = makeDeadline({ id: 1, completedAt: '2026-05-01T00:00:00Z' })
    const active = makeDeadline({ id: 2, completedAt: null })
    const result = mapDeadlinesToEvents([completed, active], '2026-05-22', typesById)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('2')
  })

  it('M7: computes isOverdue=true when date < todayStr AND completedAt === null', () => {
    const deadlines = [makeDeadline({ date: '2026-05-01', completedAt: null })]
    const result = mapDeadlinesToEvents(deadlines, '2026-05-22', typesById)
    expect(result[0].extendedProps.isOverdue).toBe(true)
  })

  it('M8: computes isOverdue=false for future date', () => {
    const deadlines = [makeDeadline({ date: '2026-06-15', completedAt: null })]
    const result = mapDeadlinesToEvents(deadlines, '2026-05-22', typesById)
    expect(result[0].extendedProps.isOverdue).toBe(false)
  })

  it('M9: computes isOverdue=false for date === todayStr (strict <, not <=)', () => {
    const deadlines = [makeDeadline({ date: '2026-05-22', completedAt: null })]
    const result = mapDeadlinesToEvents(deadlines, '2026-05-22', typesById)
    expect(result[0].extendedProps.isOverdue).toBe(false)
  })

  it('M10: returns start as literal same string as deadline.date (Object.is on the string — no UTC conversion)', () => {
    const deadlines = [makeDeadline({ date: '2026-06-15' })]
    const result = mapDeadlinesToEvents(deadlines, '2026-05-22', typesById)
    expect(Object.is(result[0].start, deadlines[0].date)).toBe(true)
  })

  it('M11: populates extendedProps.typeName from typesById.get(typeId)?.name (fixture: typesById Map<number, DeadlineType>)', () => {
    const deadlines = [makeDeadline({ typeId: 1 })]
    const result = mapDeadlinesToEvents(deadlines, '2026-05-22', typesById)
    expect(result[0].extendedProps.typeName).toBe('Filing')
  })
})

describe('CalendarView FullCalendar props (VIEW-01, VIEW-02) — DOM/grep tests, Plan 03 Task 2', () => {
  it.todo('C1: passes firstDay: 0 (Sunday week start) to FullCalendar — verified via grep on CalendarView.tsx')
  it.todo('C2: passes dayMaxEvents: 3 to FullCalendar')
  it.todo('C3: passes editable: false to FullCalendar')
  it.todo('C4: passes moreLinkClick: "popover" to FullCalendar')
})

describe('CalendarView today cell (VIEW-01) — DOM tests, Plan 03 Task 2', () => {
  it.todo('C5: renders amber-100 background on today\'s cell via dayCellClassNames')
  it.todo('C6: renders "Today" label in today\'s cell corner via dayCellContent')
  it.todo('C7: calendar.css contains #FEF3C7 !important override')
})

describe('CalendarView states (Plan 03 Task 2)', () => {
  it.todo('C8: renders loading skeleton when deadlinesQuery.isLoading')
  it.todo('C9: renders ErrorBanner with locked copy when deadlinesQuery.isError')
})

describe('CalendarView ↔ EventPill wiring (Plan 03 Task 2) — closes the typeName resolution gap', () => {
  it.todo('C10: an event pill for a known typeId renders with the expected TYPE_ABBREV text (e.g., typeId mapping to \'Filing\' → \'FIL\') — proves mapDeadlinesToEvents populates typeName so EventPill\'s TYPE_ABBREV lookup succeeds')
  it.todo('C11: extendedProps.typeName is populated at map time (not at render time) — mapDeadlinesToEvents(deadlines, todayStr, typesById) resolves typeName via typesById.get(typeId)?.name ?? \'Unknown\' before passing to FullCalendar')
})
