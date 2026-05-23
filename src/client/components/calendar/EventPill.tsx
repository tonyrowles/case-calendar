import React from 'react'
import { format } from 'date-fns'
import { parseLocalDate } from '@/shared/lib/date.js'
import type { EventContentArg } from '@fullcalendar/core'

export const TYPE_ABBREV: Record<string, string> = {
  'Filing': 'FIL',
  'Hearing': 'HRG',
  'Deposition': 'DEP',
  'Statute of Limitations': 'SOL',
  'Response/Opposition': 'RSP',
  'Status Conference': 'STC',
  'Discovery Cutoff': 'DSC',
  'Trial': 'TRL',
  'Other': 'OTH',
}

export const OVERDUE_BORDER_COLOR = '#B91C1C' // red-700

export interface EventPillExtendedProps {
  caseLabel: string
  typeId: number
  typeName: string
  description: string
  isOverdue: boolean
  completedAt: string | null  // Phase 4: null = active, string = completed timestamp
}

export interface EventPillProps {
  arg: EventContentArg
  getColor: (typeId: number) => string
}

export function EventPill({ arg, getColor }: EventPillProps): React.JSX.Element {
  const {
    caseLabel,
    typeId,
    typeName,
    isOverdue,
    completedAt,
  } = arg.event.extendedProps as EventPillExtendedProps

  // Treat undefined as null for backward compat with Phase 2/3 tests that don't pass completedAt
  const isCompleted = completedAt != null

  const borderColor = isOverdue ? OVERDUE_BORDER_COLOR : getColor(typeId)
  const abbreviation = TYPE_ABBREV[typeName] ?? typeName.slice(0, 3).toUpperCase()

  const parsedDate = parseLocalDate(arg.event.startStr)
  const formattedDate = parsedDate
    ? format(parsedDate, 'MMMM d, yyyy')
    : arg.event.startStr

  return (
    <div
      className="flex items-center gap-1 w-full overflow-hidden rounded-sm px-1 py-1"
      style={{ borderLeft: `4px solid ${borderColor}` }}
      aria-label={`${caseLabel} — ${typeName} — ${formattedDate}${isCompleted ? ' — completed' : ''}`}
    >
      {/* ✓ check mark icon before case label when completed (04-CONTEXT.md locked) */}
      {isCompleted && (
        <span className="text-xs text-muted-foreground shrink-0 mr-1" aria-hidden="true">✓</span>
      )}
      <span
        className={[
          'flex-1 text-xs truncate',
          isOverdue ? 'text-red-700' : 'text-foreground',
          isCompleted ? 'line-through' : '',
        ].filter(Boolean).join(' ')}
      >
        {caseLabel}
      </span>
      <span className="text-xs font-semibold text-muted-foreground shrink-0 ml-auto pl-1">
        {abbreviation}
      </span>
    </div>
  )
}
