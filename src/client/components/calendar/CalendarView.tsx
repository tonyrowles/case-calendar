import React, { useMemo, useRef, useState } from 'react'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import interactionPlugin from '@fullcalendar/interaction'
import type { EventContentArg, DayCellContentArg, EventClickArg } from '@fullcalendar/core'
import type { DateClickArg } from '@fullcalendar/interaction'
// PopoverAnchor is not re-exported from the shadcn wrapper; import direct from Radix
import { PopoverAnchor } from '@radix-ui/react-popover'
import { useQuery } from '@tanstack/react-query'
import type { Deadline, DeadlineType } from '@/shared/schemas/deadline.js'
import { getDeadlines } from '@/client/lib/api.js'
import { toISODateString } from '@/shared/lib/date.js'
import { useTypeColors } from '@/client/hooks/useTypeColors.js'
import { EventPill } from './EventPill.js'
import { EventPopover, type EventPopoverEvent } from './EventPopover.js'
import { ErrorBanner } from '../ErrorBanner.js'
import { Popover, PopoverContent } from '@/client/components/ui/popover.js'
import './calendar.css'

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

// dayCellContent: renders day number + "Today" label in the today cell corner
function dayCellContent(arg: DayCellContentArg) {
  return (
    <div className="relative w-full h-full">
      <span>{arg.dayNumberText}</span>
      {arg.isToday && (
        <span
          className="absolute top-0 right-0 text-xs font-semibold text-amber-700 leading-none"
          aria-label={`Today, ${arg.dayNumberText}`}
        >
          Today
        </span>
      )}
    </div>
  )
}

export function CalendarView({ onDateClick }: CalendarViewProps): React.JSX.Element {
  const deadlinesQuery = useQuery({
    queryKey: ['deadlines'],
    queryFn: getDeadlines,
  })

  const { getColor, typesById } = useTypeColors()

  // new Date() no-arg is allowed — SAFE-03 guard narrows to string-arg forms only
  const todayStr = toISODateString(new Date())

  const events = useMemo(
    () => mapDeadlinesToEvents(deadlinesQuery.data ?? [], todayStr, typesById),
    [deadlinesQuery.data, todayStr, typesById]
  )

  const [popoverOpen, setPopoverOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<EventPopoverEvent | null>(null)
  const virtualAnchorRef = useRef<{ getBoundingClientRect(): DOMRect } | null>(null)

  return (
    <>
      {deadlinesQuery.isLoading && (
        <div
          className="h-2 animate-pulse bg-muted rounded mb-4 mx-4"
          aria-label="Loading deadlines"
        />
      )}
      {deadlinesQuery.isError && (
        <ErrorBanner
          message="Couldn't load deadlines. Refresh the page."
          onDismiss={() => {}}
        />
      )}
      <FullCalendar
        plugins={[dayGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        firstDay={0}
        dayMaxEvents={3}
        moreLinkClick="popover"
        editable={false}
        height="auto"
        fixedWeekCount={false}
        headerToolbar={{ left: 'prev,next today', center: 'title', right: '' }}
        events={events}
        eventContent={(arg: EventContentArg) => <EventPill arg={arg} getColor={getColor} />}
        dayCellClassNames={(arg: DayCellContentArg) => arg.isToday ? ['bg-amber-100'] : []}
        dayCellContent={dayCellContent}
        dateClick={(arg: DateClickArg) => {
          // Guard against click-on-event bubbling (RESEARCH §Pitfall 2)
          if (arg.jsEvent.target instanceof Element && arg.jsEvent.target.closest('.fc-event')) return
          onDateClick?.(arg.dateStr)
        }}
        eventClick={(arg: EventClickArg) => {
          virtualAnchorRef.current = arg.el
          setSelectedEvent({
            caseLabel: arg.event.extendedProps.caseLabel as string,
            typeId: arg.event.extendedProps.typeId as number,
            typeName: arg.event.extendedProps.typeName as string,
            date: arg.event.startStr,
            description: (arg.event.extendedProps.description as string) ?? '',
          })
          setPopoverOpen(true)
        }}
      />
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverAnchor virtualRef={virtualAnchorRef} />
        <PopoverContent aria-labelledby="event-popover-title">
          {selectedEvent && (
            <EventPopover
              event={selectedEvent}
              getColor={getColor}
            />
          )}
        </PopoverContent>
      </Popover>
    </>
  )
}
