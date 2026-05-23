import React from 'react'
import { format } from 'date-fns'
import { parseLocalDate } from '@/shared/lib/date.js'
import type { Bucket } from '@/shared/lib/buckets.js'
import type { Deadline, DeadlineType } from '@/shared/schemas/deadline.js'

export interface DeadlineRowProps {
  deadline: Deadline
  bucket: Bucket
  typesById: Map<number, DeadlineType>
  getColor: (id: number) => string
}

export function DeadlineRow({
  deadline,
  bucket,
  typesById,
  getColor,
}: DeadlineRowProps): React.JSX.Element {
  const parsedDate = parseLocalDate(deadline.date)
  const formattedDate = parsedDate ? format(parsedDate, 'MMM d, yyyy') : deadline.date
  const typeName = typesById.get(deadline.typeId)?.name ?? 'Unknown'

  const isOverdue = bucket === 'overdue'
  const isToday = bucket === 'today'

  const containerClass = [
    'flex items-center h-12 gap-4 border-b border-border last:border-0 transition-colors',
    isOverdue ? 'bg-red-50 border-l-4 border-l-red-700 pl-3 pr-4 hover:bg-red-100' : '',
    isToday ? 'bg-amber-50 border-l-4 border-l-amber-500 pl-3 pr-4 hover:bg-amber-100' : '',
    !isOverdue && !isToday ? 'px-4 hover:bg-muted/50' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const caseLabelClass = [
    'text-sm flex-1 min-w-0 truncate',
    isOverdue ? 'text-red-700' : '',
    isToday ? 'text-amber-700' : '',
    !isOverdue && !isToday ? 'text-foreground' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const ariaLabel = `${deadline.caseLabel}, ${typeName}, due ${formattedDate}${isOverdue ? ', overdue' : ''}`

  return (
    <div
      role="row"
      aria-label={ariaLabel}
      className={containerClass}
    >
      {/* Date */}
      <span className="w-[120px] shrink-0 text-sm text-muted-foreground">
        {formattedDate}
      </span>

      {/* Case label */}
      <span className={caseLabelClass}>
        {deadline.caseLabel}
      </span>

      {/* Type: color dot + name */}
      <span className="w-[180px] shrink-0 flex items-center gap-2 text-sm text-foreground">
        <span
          className="w-3 h-3 rounded-full inline-block shrink-0"
          style={{ backgroundColor: getColor(deadline.typeId) }}
          aria-hidden="true"
        />
        {typeName}
      </span>

      {/* Description */}
      <span className="flex-1 min-w-0 text-sm text-muted-foreground truncate">
        {deadline.description ? (
          deadline.description
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </span>
    </div>
  )
}
