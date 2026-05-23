import React from 'react'
import { format } from 'date-fns'
import { parseLocalDate } from '@/shared/lib/date.js'
import { Badge } from '@/client/components/ui/badge.js'

export interface EventPopoverEvent {
  caseLabel: string
  typeId: number
  typeName: string
  date: string            // 'YYYY-MM-DD'
  description: string
}

export interface EventPopoverProps {
  event: EventPopoverEvent
  getColor: (typeId: number) => string
}

export function EventPopover({ event, getColor }: EventPopoverProps): React.JSX.Element {
  const parsedDate = parseLocalDate(event.date)
  const formattedDate = parsedDate
    ? format(parsedDate, 'MMMM d, yyyy')
    : event.date

  return (
    <div>
      <h3
        id="event-popover-title"
        className="text-sm font-semibold text-foreground mb-1"
      >
        {event.caseLabel}
      </h3>
      <div className="flex items-center gap-2 mb-1">
        <Badge style={{ backgroundColor: getColor(event.typeId), color: '#fff' }}>
          {event.typeName}
        </Badge>
        <span className="text-sm text-foreground">{formattedDate}</span>
      </div>
      <div className="border-t border-border mt-2 pt-2" />
      {event.description.trim() === '' ? (
        <p className="text-sm text-muted-foreground italic">(No description)</p>
      ) : (
        <p className="text-sm text-muted-foreground">{event.description}</p>
      )}
    </div>
  )
}
