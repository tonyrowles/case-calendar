// @vitest-environment jsdom
// Wave 0 stub. Plan 03 Task 1 (mapping + popover + CSS) converts the M-series and P-series
// todos to live `it()`. Plan 03 Task 2 (FullCalendar integration) converts the C-series todos
// to live `it()`.
//
// The 3-arg signature for mapDeadlinesToEvents is LOCKED here:
//   mapDeadlinesToEvents(deadlines: Deadline[], todayStr: string, typesById: Map<number, DeadlineType>)
// Plan 03 implements against this signature without renegotiation.
import { describe, it } from 'vitest'

describe('mapDeadlinesToEvents (SAFE-01, SAFE-02) — pure function, 3-arg signature: (deadlines, todayStr, typesById)', () => {
  it.todo('M1: maps date \'2026-06-15\' to start \'2026-06-15\' verbatim (SAFE-01) — fixture: typesById Map with one type')
  it.todo('M2: maps DST spring-forward 2026-03-08 to start \'2026-03-08\' verbatim (SAFE-02)')
  it.todo('M3: maps day-after spring-forward 2026-03-09 to start \'2026-03-09\' verbatim (SAFE-02)')
  it.todo('M4: maps DST fall-back 2026-11-01 to start \'2026-11-01\' verbatim (SAFE-02)')
  it.todo('M5: maps day-after fall-back 2026-11-02 to start \'2026-11-02\' verbatim (SAFE-02)')
  it.todo('M6: filters out deadlines with completedAt !== null')
  it.todo('M7: computes isOverdue=true when date < todayStr AND completedAt === null')
  it.todo('M8: computes isOverdue=false for future date')
  it.todo('M9: computes isOverdue=false for date === todayStr (strict <, not <=)')
  it.todo('M10: returns start as literal same string as deadline.date (Object.is on the string — no UTC conversion)')
  it.todo('M11: populates extendedProps.typeName from typesById.get(typeId)?.name (fixture: typesById Map<number, DeadlineType>)')
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
