import React from 'react'
import { format } from 'date-fns'
import { Copy } from 'lucide-react'
import { parseLocalDate } from '@/shared/lib/date.js'
import { Badge } from '@/client/components/ui/badge.js'
import { Button } from '@/client/components/ui/button.js'

export interface EventPopoverEvent {
  id: number
  caseLabel: string
  typeId: number
  typeName: string
  date: string            // 'YYYY-MM-DD'
  description: string
}

export interface EventPopoverProps {
  event: EventPopoverEvent
  getColor: (typeId: number) => string
  onDuplicate?: (id: number) => void
}

export function EventPopover({ event, getColor, onDuplicate }: EventPopoverProps): React.JSX.Element {
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
      {onDuplicate && (
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onDuplicate(event.id)}
            aria-label="Duplicate this deadline"
          >
            <Copy className="h-3.5 w-3.5 mr-1" aria-hidden="true" />
            Duplicate Deadline
          </Button>
        </div>
      )}
    </div>
  )
}
