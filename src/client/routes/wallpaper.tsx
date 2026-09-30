import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { addDays, format, startOfWeek } from 'date-fns'
import { useSearchParams } from 'react-router-dom'
import { Calendar as CalendarIcon } from 'lucide-react'

import { getDeadlines } from '@/client/lib/api.js'
import { parseLocalDate, toISODateString } from '@/shared/lib/date.js'
import { groupByBucket } from '@/shared/lib/buckets.js'
import { caseTextColor } from '@/shared/lib/case-colors.js'
import { useCaseColors } from '@/client/hooks/useCaseColors.js'
import { useTypeColors } from '@/client/hooks/useTypeColors.js'
import type { Deadline, DeadlineType } from '@/shared/schemas/deadline.js'

// Layout: 7680×2160 canvas. Rolling multi-week calendar on the left (this week + the
// next few), upcoming list on the right. Sized for ~3-4 foot viewing distance on a
// 57" 32:9 display. No overdue treatment: the wallpaper is a glance view, not a task
// list — past days are simply dimmed.
const CANVAS_W = 7680
const CANVAS_H = 2160
// Empty strip on the left where Windows places desktop icons by default (column-major from top-left)
const ICON_GUTTER = 480
const LIST_W = 1400      // list pane sized to its content so spare width goes to the icon gutter
const WEEK_STARTS_ON = 0 // Sunday — matches CalendarView firstDay={0} and weekBoundaries()
const WEEKS_SHOWN = 5    // this week + 4
const MAX_PER_CELL = 3   // calendar cell overflow → "+N more"
// Rows that fit in the list pane at these font sizes (4 section headers + rows).
// Shared across sections in order, so overflow is always an explicit "+N more", never clipped.
const LIST_ROW_BUDGET = 14

// Colors come from the case (useCaseColors, shared with the main app); types are
// shown by name only.
type ColorFns = {
  typesById: Map<number, DeadlineType>
  caseColorOf: (caseLabel: string) => string
}

/**
 * Event title for display: the first non-empty line of the description
 * (e.g. "Smith Deposition", "Rebuttal Reports Due"). Null when there is none.
 */
export function deadlineTitle(d: Pick<Deadline, 'description'>): string | null {
  const first = d.description?.split(/\r?\n/).find(line => line.trim() !== '')
  return first ? first.trim() : null
}

function formatIso(iso: string, pattern: string): string {
  const d = parseLocalDate(iso)
  return d ? format(d, pattern) : iso
}

// Title on top; case badge (case color fill, black/white text for contrast) · type
// below. Without a title, the type name moves up to the title line.
function TitleBlock({ deadline, typesById, caseColorOf, titleSize }: { deadline: Deadline; titleSize: number } & ColorFns) {
  const typeName = typesById.get(deadline.typeId)?.name ?? 'Unknown'
  const title = deadlineTitle(deadline)
  return (
    <>
      <span className="overflow-hidden text-ellipsis text-foreground" style={{ fontSize: `${titleSize}px`, lineHeight: `${titleSize + 8}px`, fontWeight: 600 }}>
        {title ?? typeName}
      </span>
      <span className="overflow-hidden text-ellipsis" style={{ fontSize: '26px', lineHeight: '34px' }}>
        <span
          data-testid="wallpaper-case-badge"
          className="rounded-sm px-2"
          style={{ backgroundColor: caseColorOf(deadline.caseLabel), color: caseTextColor(caseColorOf(deadline.caseLabel)), fontWeight: 600 }}
        >
          {deadline.caseLabel}
        </span>
        {title && <><span className="text-muted-foreground"> · </span><span className="text-muted-foreground">{typeName}</span></>}
      </span>
    </>
  )
}

function CalendarChip({ deadline, ...colors }: { deadline: Deadline } & ColorFns) {
  return (
    <div
      data-testid="wallpaper-chip"
      className="flex flex-col rounded-sm border-l-8 pl-3 pr-2 py-1 overflow-hidden whitespace-nowrap"
      style={{ borderColor: colors.caseColorOf(deadline.caseLabel) }}
    >
      <TitleBlock deadline={deadline} titleSize={34} {...colors} />
    </div>
  )
}

function RollingCalendar({ deadlines, today, todayStr, ...colors }: {
  deadlines: Deadline[]
  today: Date
  todayStr: string
} & ColorFns) {
  const days = useMemo(() => {
    const start = startOfWeek(today, { weekStartsOn: WEEK_STARTS_ON })
    return Array.from({ length: WEEKS_SHOWN * 7 }, (_, i) => addDays(start, i))
  }, [today])
  const weekdayLabels = days.slice(0, 7).map(d => format(d, 'EEE'))

  const byDate = useMemo(() => {
    const map = new Map<string, Deadline[]>()
    for (const d of deadlines) {
      const list = map.get(d.date)
      if (list) list.push(d)
      else map.set(d.date, [d])
    }
    for (const list of map.values()) list.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    return map
  }, [deadlines])

  return (
    <section data-testid="wallpaper-calendar" className="flex flex-col h-full min-h-0">
      <div className="grid grid-cols-7 mb-2">
        {weekdayLabels.map(label => (
          <div key={label} className="text-3xl font-semibold text-muted-foreground px-4">{label}</div>
        ))}
      </div>
      <div
        className="grid grid-cols-7 flex-1 min-h-0 border-t border-l border-border"
        style={{ gridTemplateRows: `repeat(${WEEKS_SHOWN}, minmax(0, 1fr))` }}
      >
        {days.map((day, i) => {
          const iso = toISODateString(day)
          const isToday = iso === todayStr
          const isPast = iso < todayStr
          // Month name on the first cell and on the 1st of each month so the rolling range reads clearly
          const label = i === 0 || day.getDate() === 1 ? format(day, 'MMM d') : format(day, 'd')
          const items = byDate.get(iso) ?? []
          const shown = items.slice(0, MAX_PER_CELL)
          const hidden = items.length - shown.length
          return (
            <div
              key={iso}
              data-testid={`wallpaper-day-${iso}`}
              className={`flex flex-col gap-2 min-h-0 overflow-hidden border-r border-b border-border p-3 ${isToday ? 'bg-amber-50' : ''} ${isPast ? 'opacity-40' : ''}`}
              style={isToday ? { boxShadow: 'inset 0 0 0 4px #B45309' } : undefined} // allow-hex: today ring (amber-700)
            >
              <div className={`text-3xl ${isToday ? 'font-bold text-amber-700' : 'text-foreground'}`}>{label}</div>
              {shown.map(d => <CalendarChip key={d.id} deadline={d} {...colors} />)}
              {hidden > 0 && <div className="text-2xl text-muted-foreground pl-3">+{hidden} more</div>}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// List row: date column, then title over type · case
function ListRow({ deadline, ...colors }: { deadline: Deadline } & ColorFns) {
  return (
    <div className="flex items-start gap-6 border-l-8 rounded-sm pl-4 py-1 mb-3" style={{ borderColor: colors.caseColorOf(deadline.caseLabel) }}>
      <span className="shrink-0 text-3xl tabular-nums text-muted-foreground" style={{ width: '220px', lineHeight: '40px' }}>
        {formatIso(deadline.date, 'EEE, MMM d')}
      </span>
      <div className="flex flex-col min-w-0 whitespace-nowrap">
        <TitleBlock deadline={deadline} titleSize={32} {...colors} />
      </div>
    </div>
  )
}

function BucketSection({ testid, title, titleClass = 'text-foreground', items, emptyText, limit, ...colors }: {
  testid: string
  title: string
  titleClass?: string
  items: Deadline[]
  emptyText: string
  limit?: number
} & ColorFns) {
  const shown = limit === undefined ? items : items.slice(0, limit)
  const hidden = items.length - shown.length
  return (
    <div data-testid={testid} className="mb-10">
      <div className="pb-2 border-b border-border mb-4">
        <div className={`text-4xl font-semibold ${titleClass}`}>{title}</div>
      </div>
      {items.length === 0
        ? <p className="text-3xl text-muted-foreground italic">{emptyText}</p>
        : shown.map(d => <ListRow key={d.id} deadline={d} {...colors} />)}
      {hidden > 0 && <p className="text-3xl text-muted-foreground pl-4">+{hidden} more</p>}
    </div>
  )
}

export function WallpaperView(): React.JSX.Element {
  const deadlinesQuery = useQuery({
    queryKey: ['deadlines'],
    queryFn: getDeadlines,
  })

  const { typesById, isLoading: typesLoading, isError: typesError } = useTypeColors()

  const [searchParams] = useSearchParams()

  // Capture a single Date at component mount so todayStr is always consistent.
  // new Date() no-arg is allowed — SAFE-03 guard narrows to string-arg forms only.
  const today = useMemo(() => new Date(), [])
  const todayStr = toISODateString(today)

  const deadlines = deadlinesQuery.data ?? []

  // Read ?t= and compute lastUpdated.
  // SAFE-03 reaffirmed: new Date(tNumber) is a NUMBER arg (allowed).
  // new Date() is no-arg (allowed). No string-arg new Date(...) calls in this file.
  const tParam = searchParams.get('t')
  const tNumber = tParam !== null && tParam !== '' ? Number(tParam) : NaN
  const lastUpdated = Number.isFinite(tNumber) ? new Date(tNumber) : new Date()
  const timestampStr = format(lastUpdated, "h:mm a 'on' MMM d, yyyy")

  // The wallpaper is display-only: completed deadlines are always hidden, and past
  // deadlines only appear (dimmed) on the calendar, never in the list.
  const active = useMemo(() => deadlines.filter(d => d.completedAt === null), [deadlines])
  const buckets = useMemo(() => groupByBucket(active, todayStr), [active, todayStr])
  // Same case colors as the main app (assigned across all open deadlines)
  const caseColorOf = useCaseColors()
  const colors: ColorFns = { typesById, caseColorOf }
  const allEmpty =
    buckets.today.length + buckets.thisWeek.length + buckets.nextWeek.length + buckets.later.length === 0

  // Hand out the list's row budget to sections in display order
  const sections = [buckets.today, buckets.thisWeek, buckets.nextWeek, buckets.later]
  let remaining = LIST_ROW_BUDGET
  const [todayLimit, thisWeekLimit, nextWeekLimit, laterLimit] = sections.map(items => {
    const n = Math.min(items.length, remaining)
    remaining -= n
    return n
  })

  const rangeStart = startOfWeek(today, { weekStartsOn: WEEK_STARTS_ON })
  const rangeEnd = addDays(rangeStart, WEEKS_SHOWN * 7 - 1)

  if (deadlinesQuery.isLoading || typesLoading) {
    return <div className="animate-pulse bg-muted rounded h-4 w-40" />
  }
  if (deadlinesQuery.isError || typesError) {
    return <div className="text-red-700 p-8">Failed to load deadlines. Refresh the page.</div>
  }

  return (
    <div
      data-testid="wallpaper-root"
      style={{
        width: `${CANVAS_W}px`,
        height: `${CANVAS_H}px`,
        overflow: 'hidden',
        background: '#FFFFFF', // allow-hex: wallpaper canvas background (not a type color)
        fontFamily: 'var(--font-sans)',
        position: 'relative',
        paddingLeft: `${ICON_GUTTER}px`,
      }}
      className="p-16 flex flex-col"
    >
      <header className="flex items-baseline justify-between pb-4 border-b border-border mb-8">
        <div data-testid="wallpaper-range" className="text-5xl font-semibold text-foreground">
          {format(rangeStart, 'MMM d')} – {format(rangeEnd, 'MMM d, yyyy')}
        </div>
        <div className="text-4xl text-muted-foreground">{format(today, 'EEEE, MMMM d')}</div>
      </header>

      <div className="flex-1 min-h-0 pb-8" style={{ display: 'grid', gridTemplateColumns: `minmax(0, 1fr) ${LIST_W}px`, gap: '96px' }}>
        <RollingCalendar deadlines={active} today={today} todayStr={todayStr} {...colors} />

        <section data-testid="wallpaper-list" className="min-w-0 min-h-0 overflow-hidden">
          {allEmpty ? (
            <div className="flex flex-col items-center justify-center h-full gap-6">
              <CalendarIcon className="w-24 h-24 text-muted-foreground" />
              <p className="text-4xl text-muted-foreground">All caught up — no upcoming deadlines</p>
            </div>
          ) : (
            <>
              <BucketSection testid="wallpaper-bucket-today" title="TODAY" titleClass="text-amber-700"
                items={buckets.today} emptyText="Nothing due today." limit={todayLimit} {...colors} />
              <BucketSection testid="wallpaper-bucket-thisWeek" title="THIS WEEK"
                items={buckets.thisWeek} emptyText="Nothing else this week." limit={thisWeekLimit} {...colors} />
              <BucketSection testid="wallpaper-bucket-nextWeek" title="NEXT WEEK"
                items={buckets.nextWeek} emptyText="Nothing next week." limit={nextWeekLimit} {...colors} />
              <BucketSection testid="wallpaper-bucket-later" title="LATER"
                items={buckets.later} emptyText="Nothing on the horizon." limit={laterLimit} {...colors} />
            </>
          )}
        </section>
      </div>

      {/* Bottom-right timestamp footer — always visible */}
      <span
        data-testid="wallpaper-timestamp"
        className="absolute bottom-6 right-16 text-2xl text-muted-foreground"
      >
        Last updated {timestampStr}
      </span>
    </div>
  )
}
