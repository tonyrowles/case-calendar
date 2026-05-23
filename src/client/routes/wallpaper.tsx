import React, { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'

import { getDeadlines, getDeadlineTypes } from '@/client/lib/api.js'
import { parseLocalDate, toISODateString } from '@/shared/lib/date.js'
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
  return (
    <div className="flex flex-col gap-1 w-full rounded-sm px-4 py-2 mb-2 border-l-4" style={{ borderColor }}>
      <span className={labelClass}>{deadline.caseLabel}</span>
      <span style={{ fontSize: '28px', fontWeight: '600', color: nameColor }}>{typeName}</span>
    </div>
  )
}

export function WallpaperView(): JSX.Element {
  const deadlinesQuery = useQuery({
    queryKey: ['deadlines'],
    queryFn: getDeadlines,
  })

  const typesQuery = useQuery({
    queryKey: ['deadline-types'],
    queryFn: getDeadlineTypes,
  })

  const { getColor } = useTypeColors()

  const typesById = useMemo(
    () => new Map((typesQuery.data ?? []).map(t => [t.id, t])),
    [typesQuery.data]
  )

  // new Date() no-arg is allowed — SAFE-03 guard narrows to string-arg forms only
  const today = new Date()
  const todayStr = toISODateString(today)

  // Build the 14-day window from today inclusive
  const days = useMemo((): string[] => {
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date()
      d.setDate(d.getDate() + i)
      return toISODateString(d)
    })
  }, [todayStr])

  const deadlines = deadlinesQuery.data ?? []

  // Overdue: completed_at IS NULL AND date < today (strict less-than — today itself is NOT overdue)
  const overdue = useMemo(
    () => deadlines.filter(d => d.completedAt === null && d.date < todayStr),
    [deadlines, todayStr]
  )

  // Upcoming: group by date string for each of the 14 day columns
  const byDay = useMemo(
    () => new Map<string, Deadline[]>(
      days.map(dateStr => [
        dateStr,
        deadlines.filter(d => d.completedAt === null && d.date === dateStr),
      ])
    ),
    [deadlines, days]
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

  if (deadlinesQuery.isLoading) {
    return <div className="animate-pulse bg-muted rounded h-4 w-40" />
  }

  return (
    <div
      data-testid="wallpaper-root"
      style={{
        width: '7680px',
        height: '2160px',
        overflow: 'hidden',
        background: '#FFFFFF',
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
        {days.map(dateStr => (
          <div key={dateStr} data-testid={`wallpaper-column-${dateStr}`} className="rounded-lg p-4">
            <div className="pb-4 border-b border-border mb-4">
              <div className="text-4xl font-semibold">
                {format(parseLocalDate(dateStr) ?? new Date(), 'MMM d').toUpperCase()}
              </div>
              <div style={{ fontSize: '28px' }} className="text-muted-foreground">
                {format(parseLocalDate(dateStr) ?? new Date(), 'EEEE')}
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
        ))}
      </div>
    </div>
  )
}
