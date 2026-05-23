// @vitest-environment jsdom
// Wave 0 stub. Plan 03 Task 1 (mapping + popover + CSS) converts the M-series
// todos to live `it()`. Plan 03 Task 2 (FullCalendar integration) converts the C-series todos
// to live `it()`.
//
// The 3-arg signature for mapDeadlinesToEvents is LOCKED here:
//   mapDeadlinesToEvents(deadlines: Deadline[], todayStr: string, typesById: Map<number, DeadlineType>)
// Plan 03 implements against this signature without renegotiation.
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { mapDeadlinesToEvents } from './CalendarView.js'
import { CalendarView } from './CalendarView.js'
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

// Helper to render CalendarView with a pre-seeded QueryClient
function renderWithQuery(
  ui: React.ReactElement,
  seed?: (queryClient: QueryClient) => void
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  })
  if (seed) seed(queryClient)
  const result = render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  )
  return { ...result, queryClient }
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
  it('C1: passes firstDay: 0 (Sunday week start) to FullCalendar — verified via grep on CalendarView.tsx', () => {
    const content = readFileSync(
      path.resolve('src/client/components/calendar/CalendarView.tsx'),
      'utf8'
    )
    const count = (content.match(/firstDay=\{0\}/g) ?? []).length
    expect(count).toBeGreaterThanOrEqual(1)
  })

  it('C2: passes dayMaxEvents: 3 to FullCalendar', () => {
    const content = readFileSync(
      path.resolve('src/client/components/calendar/CalendarView.tsx'),
      'utf8'
    )
    const count = (content.match(/dayMaxEvents=\{3\}/g) ?? []).length
    expect(count).toBeGreaterThanOrEqual(1)
  })

  it('C3: passes editable: false to FullCalendar', () => {
    const content = readFileSync(
      path.resolve('src/client/components/calendar/CalendarView.tsx'),
      'utf8'
    )
    const count = (content.match(/editable=\{false\}/g) ?? []).length
    expect(count).toBeGreaterThanOrEqual(1)
  })

  it('C4: passes moreLinkClick: "popover" to FullCalendar', () => {
    const content = readFileSync(
      path.resolve('src/client/components/calendar/CalendarView.tsx'),
      'utf8'
    )
    expect(content).toMatch('moreLinkClick="popover"')
  })
})

describe('CalendarView today cell (VIEW-01) — DOM tests, Plan 03 Task 2', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Pin today to May 22, 2026 at noon local time
    vi.setSystemTime(new Date(2026, 4, 22, 12, 0, 0))
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('C5: renders amber-100 background on today\'s cell via dayCellClassNames', async () => {
    const { container } = renderWithQuery(
      <CalendarView />,
      qc => {
        qc.setQueryData(['deadlines'], [])
        qc.setQueryData(['deadline-types'], [])
      }
    )
    // Wait for FullCalendar to render the grid
    const todayCell = await new Promise<Element | null>((resolve) => {
      const check = () => {
        const el = container.querySelector('.fc-day-today')
        if (el) resolve(el)
        else setTimeout(check, 50)
      }
      check()
      setTimeout(() => resolve(null), 3000)
    })
    expect(todayCell).not.toBeNull()
    expect(todayCell!.classList.contains('bg-amber-100')).toBe(true)
  })

  it('C6: renders "Today" label in today\'s cell corner via dayCellContent', async () => {
    const { container } = renderWithQuery(
      <CalendarView />,
      qc => {
        qc.setQueryData(['deadlines'], [])
        qc.setQueryData(['deadline-types'], [])
      }
    )
    // C5 proved .fc-day-today cell is present. Check dayCellContent rendered "Today" text.
    // FullCalendar renders dayCellContent synchronously on initial mount.
    const todayCell = container.querySelector('.fc-day-today')
    expect(todayCell).not.toBeNull()
    expect(todayCell!.textContent).toContain('Today')
  })

  it('C7: calendar.css contains #FEF3C7 !important override', () => {
    const content = readFileSync(
      path.resolve('src/client/components/calendar/calendar.css'),
      'utf8'
    )
    const count = (content.match(/#FEF3C7 !important/g) ?? []).length
    expect(count).toBeGreaterThanOrEqual(1)
  })
})

describe('CalendarView states (Plan 03 Task 2)', () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('C8: renders loading skeleton when deadlinesQuery.isLoading', async () => {
    // Use a QueryClient where queries never resolve (loading state)
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          // queryFn returning a never-resolving promise = loading state
          queryFn: () => new Promise(() => {}),
        },
      },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <CalendarView />
      </QueryClientProvider>
    )
    const skeleton = await screen.findByLabelText('Loading deadlines', undefined, { timeout: 3000 })
    expect(skeleton).not.toBeNull()
  })

  it('C9: renders ErrorBanner with locked copy when deadlinesQuery.isError', async () => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          queryFn: () => Promise.reject(new Error('fetch failed')),
        },
      },
    })
    render(
      <QueryClientProvider client={queryClient}>
        <CalendarView />
      </QueryClientProvider>
    )
    const errorMsg = await screen.findByText(/Couldn't load deadlines/, undefined, { timeout: 3000 })
    expect(errorMsg).not.toBeNull()
  })
})

describe('CalendarView ↔ EventPill wiring (Plan 03 Task 2) — closes the typeName resolution gap', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 22, 12, 0, 0))
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('C10: an event pill for a known typeId renders with the expected TYPE_ABBREV text (e.g., typeId mapping to \'Filing\' → \'FIL\') — proves mapDeadlinesToEvents populates typeName so EventPill\'s TYPE_ABBREV lookup succeeds', () => {
    const { container } = renderWithQuery(
      <CalendarView />,
      qc => {
        qc.setQueryData(['deadline-types'], [
          { id: 1, name: 'Filing', color: '#1D4ED8', createdAt: '' }
        ])
        qc.setQueryData(['deadlines'], [
          {
            id: 1,
            date: '2026-05-28',
            caseLabel: 'Smith',
            typeId: 1,
            description: null,
            completedAt: null,
            createdAt: '',
            updatedAt: '',
          }
        ])
      }
    )
    // FullCalendar renders event content synchronously on initial mount.
    // screen.queryByText('FIL') finds the TYPE_ABBREV abbreviation from EventPill.
    // Falls back to aria-label check if text node is nested.
    // Proves: mapDeadlinesToEvents populated extendedProps.typeName = 'Filing'
    //         and EventPill applied TYPE_ABBREV['Filing'] = 'FIL'
    const filText = screen.queryByText('FIL') ?? container.querySelector('[aria-label*="Filing"]')
    expect(filText).not.toBeNull()
  })

  it('C11: extendedProps.typeName is populated at map time (not at render time) — mapDeadlinesToEvents(deadlines, todayStr, typesById) resolves typeName via typesById.get(typeId)?.name ?? \'Unknown\' before passing to FullCalendar', () => {
    const deadlines = [makeDeadline({ typeId: 1 })]
    const result = mapDeadlinesToEvents(deadlines, '2026-05-22', typesById)
    // typeName is in the returned object at map time — no render needed
    expect(result[0].extendedProps.typeName).toBe('Filing')
    // Verify 'Unknown' fallback when typeId not in map
    const unknownTypes = new Map<number, DeadlineType>()
    const result2 = mapDeadlinesToEvents(deadlines, '2026-05-22', unknownTypes)
    expect(result2[0].extendedProps.typeName).toBe('Unknown')
  })
})
