import React, { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react'
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
import { classifyDeadline } from '@/shared/lib/buckets.js'
import { useTypeColors } from '@/client/hooks/useTypeColors.js'
import { EventPill } from './EventPill.js'
import { EventPopover, type EventPopoverEvent } from './EventPopover.js'
import { ErrorBanner } from '../ErrorBanner.js'
import { Popover, PopoverContent } from '@/client/components/ui/popover.js'
import './calendar.css'

/** Imperative handle exposed via forwardRef — consumers call ref.current?.jumpToToday() */
export interface CalendarViewHandle {
  jumpToToday: () => void
}

export interface CalendarViewProps {
  onDateClick?: (dateStr: string) => void  // empty-cell click; Plan 04 wires this to DeadlineForm
  deadlines?: Deadline[]   // OPTIONAL — when undefined, fall back to useQuery (Phase 2 behavior)
  todayStr?: string         // OPTIONAL — when undefined, fall back to local derivation
  /** Called when user clicks an event pill (lifts selectedDeadlineId to App) */
  onEventClick?: (id: number) => void
}

// Pure helper exported for unit testing (SAFE-01/02 proof targets).
// 3-arg signature locked in Plan 01 — typesById is required so extendedProps.typeName
// is populated at map time, enabling EventPill's TYPE_ABBREV lookup to succeed.
//
// Phase 4 change: removed .filter(d => d.completedAt === null) — the parent applyFilters
// in App.tsx now handles completedAt filtering via filters.showCompleted. This function
// threads completedAt into extendedProps so eventClassNames can add 'fc-completed'
// (RESEARCH Common Pitfall #9).
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
    completedAt: string | null      // Phase 4: for fc-completed class + EventPill ✓ icon
  }
}> {
  return deadlines.map(d => ({
    id: String(d.id),
    start: d.date,   // YYYY-MM-DD string passed verbatim — NEVER new Date(d.date)
    allDay: true as const,
    extendedProps: {
      caseLabel: d.caseLabel,
      typeId: d.typeId,
      typeName: typesById.get(d.typeId)?.name ?? 'Unknown',
      description: d.description ?? '',
      isOverdue: classifyDeadline(d, todayStr) === 'overdue',
      completedAt: d.completedAt,
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

export const CalendarView = forwardRef<CalendarViewHandle, CalendarViewProps>(
function CalendarView({ onDateClick, deadlines: deadlinesProp, todayStr: todayStrProp, onEventClick }: CalendarViewProps, ref): React.JSX.Element {
  // Imperative handle: expose jumpToToday() to parent (App.tsx) for the 't' keyboard shortcut
  const calendarApiRef = useRef<FullCalendar>(null)
  useImperativeHandle(ref, () => ({
    jumpToToday: () => { calendarApiRef.current?.getApi().today() },
  }), [])

  // When deadlinesProp is provided (Phase 3+ App wires filtered dataset), use it.
  // When undefined (Phase 2 standalone or tests without prop), fall back to useQuery.
  // useQuery is always called (hooks must not be conditional) but its data is used only as fallback.
  const deadlinesQuery = useQuery({
    queryKey: ['deadlines'],
    queryFn: getDeadlines,
    // When deadlinesProp is provided, skip the internal fetch (data is injected from App)
    enabled: deadlinesProp === undefined,
  })

  const { getColor, typesById } = useTypeColors()

  // new Date() no-arg is allowed — SAFE-03 guard narrows to string-arg forms only
  const todayStr = todayStrProp ?? toISODateString(new Date())

  // When deadlinesProp is provided, use it; otherwise fall back to internal query result
  const deadlinesData = deadlinesProp ?? (deadlinesQuery.data ?? [])

  const events = useMemo(
    () => mapDeadlinesToEvents(deadlinesData, todayStr, typesById),
    [deadlinesData, todayStr, typesById]
  )

  const [popoverOpen, setPopoverOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<EventPopoverEvent | null>(null)
  const virtualAnchorRef = useRef<{ getBoundingClientRect(): DOMRect } | null>(null)

  // Show loading/error only when using the internal query (not when data is injected via prop)
  const showLoading = deadlinesProp === undefined && deadlinesQuery.isLoading
  const showError = deadlinesProp === undefined && deadlinesQuery.isError

  return (
    <>
      {showLoading && (
        <div
          className="h-2 animate-pulse bg-muted rounded mb-4 mx-4"
          aria-label="Loading deadlines"
        />
      )}
      {showError && (
        <ErrorBanner
          message="Couldn't load deadlines. Refresh the page."
          onDismiss={() => deadlinesQuery.refetch()}
        />
      )}
      <FullCalendar
        ref={calendarApiRef}
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
        eventClassNames={(arg) => {
          // Phase 4: add 'fc-completed' class when event has a completedAt timestamp
          // This enables .fc-completed { opacity: 0.5 } in calendar.css (Common Pitfall #9)
          const completedAt = (arg.event.extendedProps as { completedAt: string | null }).completedAt
          return completedAt !== null ? ['fc-completed'] : []
        }}
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
          // Phase 4: lift selectedDeadlineId to App for edit-mode integration
          // Opening popover AND loading into edit form are both triggered here.
          // onEventClick is optional — when provided, App loads the deadline into DeadlineForm.
          onEventClick?.(Number(arg.event.id))
        }}
      />
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverAnchor virtualRef={virtualAnchorRef} />
        <PopoverContent aria-label="Event details">
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
})
