import React from 'react'
import type { Deadline, DeadlineType } from '@/shared/schemas/deadline.js'

export interface CalendarViewProps {
  onDateClick?: (dateStr: string) => void  // empty-cell click; Plan 04 wires this to DeadlineForm
}

// Pure helper exported for unit testing (SAFE-01/02 proof targets).
// 3-arg signature locked in Plan 01 — typesById is required so extendedProps.typeName
// is populated at map time, enabling EventPill's TYPE_ABBREV lookup to succeed.
export function mapDeadlinesToEvents(
  deadlines: Deadline[],
  todayStr: string,
  typesById: Map<number, DeadlineType>
): Array<{
  id: string
  start: string                     // verbatim deadline.date — never converted
  allDay: true
  extendedProps: {
    caseLabel: string
    typeId: number
    typeName: string                // typesById.get(typeId)?.name ?? 'Unknown'
    description: string
    isOverdue: boolean
  }
}> {
  return deadlines
    .filter(d => d.completedAt === null)
    .map(d => ({
      id: String(d.id),
      start: d.date,   // YYYY-MM-DD string passed verbatim — NEVER new Date(d.date)
      allDay: true as const,
      extendedProps: {
        caseLabel: d.caseLabel,
        typeId: d.typeId,
        typeName: typesById.get(d.typeId)?.name ?? 'Unknown',
        description: d.description ?? '',
        isOverdue: d.date < todayStr,
      },
    }))
}

// Placeholder — Task 2 replaces this body with the FullCalendar implementation.
export function CalendarView(_props: CalendarViewProps): React.JSX.Element {
  return <div data-placeholder="CalendarView-T2-fills-this" />
}
