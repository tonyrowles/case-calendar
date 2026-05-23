import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { useSearchParams } from 'react-router-dom'

import { getDeadlines } from '@/client/lib/api.js'
import { parseLocalDate, toISODateString } from '@/shared/lib/date.js'
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

  // Capture a single Date at component mount so todayStr and days are always consistent.
  // new Date() no-arg is allowed — SAFE-03 guard narrows to string-arg forms only.
  const todayRef = useMemo(() => new Date(), [])
  const todayStr = toISODateString(todayRef)

  // Build the 14-day window from today inclusive, cloning the captured date each iteration.
  const days = useMemo((): string[] => {
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(todayRef)
      d.setDate(d.getDate() + i)
      return toISODateString(d)
    })
  }, [todayRef])

  const deadlines = deadlinesQuery.data ?? []

  // Overdue column: ALWAYS excludes completed deadlines, regardless of ?completed=1.
  // A completed-overdue item is informational-only-not-actionable (Common Pitfall #3).
  // groupByBucket already filters out completedAt !== null for overdue, so this is correct.
  const overdue = useMemo(
    () => groupByBucket(deadlines, todayStr).overdue,
    [deadlines, todayStr]
  )

  // Day columns: include completed deadlines only when ?completed=1 is in URL
  const byDay = useMemo(
    () => new Map<string, Deadline[]>(
      days.map(dateStr => [
        dateStr,
        deadlines.filter(d => (showCompleted || d.completedAt === null) && d.date === dateStr),
      ])
    ),
    [deadlines, days, showCompleted]
  )

  // Last-updated timestamp in Los Angeles timezone
  const timestamp = new Date().toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

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
      }}
      className="p-16"
    >
      {/* Header row */}
      <header className="flex items-end justify-between pb-4 border-b border-border mb-4">
        <h1 className="text-4xl font-semibold text-foreground">Case Calendar Deadlines</h1>
        <span className="text-xl text-muted-foreground ml-auto">Last updated: {timestamp}</span>
      </header>

      {/* 15-column grid: 1 overdue + 14 day columns */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(15, 1fr)',
        gap: '16px',
        height: 'calc(2160px - 80px - 64px - 64px)',
      }}>
        {/* Overdue column */}
        <div data-testid="wallpaper-column-overdue" className="bg-red-100 rounded-lg p-4">
          <div className="pb-4 border-b border-border mb-4">
            <div className="text-4xl font-semibold text-red-700">OVERDUE</div>
          </div>
          {overdue.length === 0
            ? <p className="text-xl text-muted-foreground italic">No overdue deadlines.</p>
            : overdue.map(d => (
                <WallpaperPill
                  key={d.id}
                  deadline={d}
                  isOverdue
                  typesById={typesById}
                  getColor={getColor}
                />
              ))
          }
        </div>

        {/* 14 day columns */}
        {days.map(dateStr => {
          const parsedDate = parseLocalDate(dateStr)
          if (!parsedDate) {
            // Should never happen: dateStr always comes from toISODateString(validDate)
            console.error(`wallpaper: unparseable dateStr: ${dateStr}`)
            return null
          }
          return (
            <div key={dateStr} data-testid={`wallpaper-column-${dateStr}`} className="rounded-lg p-4">
              <div className="pb-4 border-b border-border mb-4">
                <div className="text-4xl font-semibold">
                  {format(parsedDate, 'MMM d').toUpperCase()}
                </div>
                <div style={{ fontSize: '28px' }} className="text-muted-foreground">
                  {format(parsedDate, 'EEEE')}
                </div>
              </div>
              {(byDay.get(dateStr) ?? []).map(d => (
                <WallpaperPill
                  key={d.id}
                  deadline={d}
                  isOverdue={false}
                  typesById={typesById}
                  getColor={getColor}
                />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
