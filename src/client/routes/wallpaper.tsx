import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useSearchParams } from 'react-router-dom'
import { Calendar as CalendarIcon } from 'lucide-react'

import { getDeadlines } from '@/client/lib/api.js'
import { toISODateString } from '@/shared/lib/date.js'
import { groupByBucket } from '@/shared/lib/buckets.js'
import { useTypeColors } from '@/client/hooks/useTypeColors.js'
import type { Deadline, DeadlineType } from '@/shared/schemas/deadline.js'

// Inline WallpaperPill helper — sized for ~3-4 foot viewing distance at 7680×2160
function WallpaperPill({ deadline, isOverdue, typesById, getColor }: {
  deadline: Deadline
  isOverdue: boolean
  typesById: Map<number, DeadlineType>
  getColor: (id: number) => string
}) {
  const typeName = typesById.get(deadline.typeId)?.name ?? 'Unknown'
  const borderColor = isOverdue ? '#B91C1C' : getColor(deadline.typeId)
  const labelClass = isOverdue ? 'text-2xl text-red-700' : 'text-2xl text-foreground'
  const nameColor = isOverdue ? '#B91C1C' : getColor(deadline.typeId)
  const isCompleted = deadline.completedAt !== null
  return (
    <div
      className={`flex flex-col gap-1 w-full rounded-sm px-4 py-2 mb-2 border-l-4${isCompleted ? ' opacity-50' : ''}`}
      style={{ borderColor }}
    >
      <span className={`${labelClass}${isCompleted ? ' line-through' : ''}`}>{deadline.caseLabel}</span>
      <span style={{ fontSize: '28px', fontWeight: '600', color: nameColor }}>{typeName}</span>
    </div>
  )
}

// Inline BucketSection helper — renders a titled section of deadline pills inside a column
function BucketSection({ testid, title, titleClass = 'text-foreground', items, isOverdue = false, typesById, getColor, emptyText }: {
  testid: string
  title: string
  titleClass?: string
  items: Deadline[]
  isOverdue?: boolean
  typesById: Map<number, DeadlineType>
  getColor: (id: number) => string
  emptyText: string
}) {
  return (
    <div data-testid={testid} className="mb-6">
      <div className="pb-2 border-b border-border mb-3">
        <div className={`text-3xl font-semibold ${titleClass}`}>{title}</div>
      </div>
      {items.length === 0
        ? <p className="text-xl text-muted-foreground italic">{emptyText}</p>
        : items.map(d => (
            <WallpaperPill key={d.id} deadline={d} isOverdue={isOverdue} typesById={typesById} getColor={getColor} />
          ))}
    </div>
  )
}

export function WallpaperView(): React.JSX.Element {
  const deadlinesQuery = useQuery({
    queryKey: ['deadlines'],
    queryFn: getDeadlines,
  })

  const { getColor, typesById, isLoading: typesLoading, isError: typesError } = useTypeColors()

  // Phase 4: read showCompleted from URL params directly (NOT via useFilters — wallpaper is a
  // separate route that should not inherit FilterBar state from the main app).
  // T-04-03-01: strict '=== 1' comparison rejects any other value.
  const [searchParams] = useSearchParams()
  const showCompleted = searchParams.get('completed') === '1'

  // Capture a single Date at component mount so todayStr is always consistent.
  // new Date() no-arg is allowed — SAFE-03 guard narrows to string-arg forms only.
  const todayRef = useMemo(() => new Date(), [])
  const todayStr = toISODateString(todayRef)

  const deadlines = deadlinesQuery.data ?? []

  // Read ?t= and compute lastUpdated.
  // SAFE-03 reaffirmed: new Date(tNumber) is a NUMBER arg (allowed).
  // new Date() is no-arg (allowed). No string-arg new Date(...) calls in this file.
  const tParam = searchParams.get('t')
  const tNumber = tParam !== null && tParam !== '' ? Number(tParam) : NaN
  const lastUpdated = Number.isFinite(tNumber) ? new Date(tNumber) : new Date()
  const timestampStr = format(lastUpdated, "h:mm a 'on' MMM d, yyyy")

  // Compute buckets from all deadlines, then apply completed filter to non-overdue buckets.
  // groupByBucket already excludes completedAt !== null for overdue.
  const buckets = useMemo(() => groupByBucket(deadlines, todayStr), [deadlines, todayStr])
  const filterCompleted = (arr: Deadline[]) => (showCompleted ? arr : arr.filter(d => d.completedAt === null))
  const visibleBuckets = useMemo(() => ({
    overdue:  buckets.overdue,                       // groupByBucket already excludes completed for overdue
    today:    filterCompleted(buckets.today),
    thisWeek: filterCompleted(buckets.thisWeek),
    nextWeek: filterCompleted(buckets.nextWeek),
    later:    filterCompleted(buckets.later),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [buckets, showCompleted])

  const totalVisible =
    visibleBuckets.overdue.length + visibleBuckets.today.length +
    visibleBuckets.thisWeek.length + visibleBuckets.nextWeek.length +
    visibleBuckets.later.length
  const allEmpty = totalVisible === 0

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
        width: '7680px',
        height: '2160px',
        overflow: 'hidden',
        background: '#FFFFFF', // allow-hex: wallpaper canvas background (not a type color)
        fontFamily: 'var(--font-sans)',
        position: 'relative',
      }}
      className="p-16"
    >
      {/* Header row */}
      <header className="flex items-end justify-between pb-4 border-b border-border mb-4">
        <h1 className="text-4xl font-semibold text-foreground">Case Calendar Deadlines</h1>
      </header>

      {/* Main body: 3-column grid or empty state */}
      {allEmpty ? (
        <div className="flex flex-col items-center justify-center h-full gap-4">
          <CalendarIcon className="w-24 h-24 text-muted-foreground" />
          <p className="text-3xl text-muted-foreground">All caught up — no upcoming deadlines</p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '32px',
          height: 'calc(2160px - 80px - 64px - 64px)',
        }}>
          {/* Column 1: Priority (Overdue + Today) */}
          <div data-testid="wallpaper-column-priority" className="rounded-lg p-4 bg-red-50">
            <BucketSection testid="wallpaper-bucket-overdue" title="OVERDUE" titleClass="text-red-700"
              items={visibleBuckets.overdue} isOverdue typesById={typesById} getColor={getColor}
              emptyText="No overdue deadlines." />
            <BucketSection testid="wallpaper-bucket-today" title="TODAY" titleClass="text-amber-700"
              items={visibleBuckets.today} typesById={typesById} getColor={getColor}
              emptyText="Nothing due today." />
          </div>

          {/* Column 2: Current (This Week + Next Week) */}
          <div data-testid="wallpaper-column-current" className="rounded-lg p-4">
            <BucketSection testid="wallpaper-bucket-thisWeek" title="THIS WEEK"
              items={visibleBuckets.thisWeek} typesById={typesById} getColor={getColor}
              emptyText="Nothing this week." />
            <BucketSection testid="wallpaper-bucket-nextWeek" title="NEXT WEEK"
              items={visibleBuckets.nextWeek} typesById={typesById} getColor={getColor}
              emptyText="Nothing next week." />
          </div>

          {/* Column 3: Later */}
          <div data-testid="wallpaper-column-later" className="rounded-lg p-4">
            <BucketSection testid="wallpaper-bucket-later" title="LATER"
              items={visibleBuckets.later} typesById={typesById} getColor={getColor}
              emptyText="Nothing on the horizon." />
          </div>
        </div>
      )}

      {/* Bottom-right timestamp footer — always visible */}
      <span
        data-testid="wallpaper-timestamp"
        className="absolute bottom-8 right-12 text-sm text-muted-foreground"
      >
        Last updated {timestampStr}
      </span>
    </div>
  )
}
