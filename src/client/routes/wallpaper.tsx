import React, { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { addDays, format, startOfWeek } from 'date-fns'
import { useSearchParams } from 'react-router-dom'
import { Calendar as CalendarIcon } from 'lucide-react'

import { getDeadlines, getEmailInbox, getSettings, wallpaperBackgroundUrl } from '@/client/lib/api.js'
import { parseLocalDate, toISODateString } from '@/shared/lib/date.js'
import { groupByBucket, type Bucket } from '@/shared/lib/buckets.js'
import { caseTextColor, liftForDarkBackground } from '@/shared/lib/case-colors.js'
import { DEFAULT_WALLPAPER_THEME, WALLPAPER_THEMES, glassCanvasWithImage, isWallpaperThemeId, type WallpaperTheme } from '@/shared/lib/wallpaper-themes.js'
import { allocateListRows, computeWallpaperLayout, type WallpaperLayout } from '@/shared/lib/wallpaper-layout.js'
import { useCaseColors } from '@/client/hooks/useCaseColors.js'
import { useTypeColors } from '@/client/hooks/useTypeColors.js'
import type { Deadline, DeadlineType } from '@/shared/schemas/deadline.js'

// Desktop wallpaper for any screen. Size comes from ?w=&h= (logical px; the wallpaper
// worker sets them from the chosen monitor) or the window size. All dimensions come from
// computeWallpaperLayout (src/shared/lib/wallpaper-layout.ts); the line heights used
// here are the layout's, so its row/entry budgets hold by construction. No overdue
// treatment: the wallpaper is a glance view, not a task list - past days are dimmed.
const WEEK_STARTS_ON = 0 // Sunday - matches weekBoundaries()

type Ctx = {
  typesById: Map<number, DeadlineType>
  caseColorOf: (caseLabel: string) => string
  theme: WallpaperTheme
  L: WallpaperLayout
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

const text = (L: WallpaperLayout, key: keyof WallpaperLayout['font']): React.CSSProperties =>
  ({ fontSize: `${L.font[key]}px`, lineHeight: `${L.line[key]}px` })

// Title on top; case badge (case color fill, black/white text for contrast) · type below.
// Without a title, the type name moves up to the title line.
function TitleBlock({ deadline, typesById, caseColorOf, theme, L, titleKey, metaKey }: {
  deadline: Deadline
  titleKey: 'chipTitle' | 'listTitle'
  metaKey: 'chipMeta' | 'listMeta'
} & Ctx) {
  const typeName = typesById.get(deadline.typeId)?.name ?? 'Unknown'
  const title = deadlineTitle(deadline)
  const color = caseColorOf(deadline.caseLabel)
  return (
    <>
      <span className="overflow-hidden text-ellipsis text-foreground" style={{ ...text(L, titleKey), fontWeight: 600 }}>
        {title ?? typeName}
      </span>
      <span className="overflow-hidden text-ellipsis" style={text(L, metaKey)}>
        <span
          data-testid="wallpaper-case-badge"
          className="rounded-sm"
          style={{ backgroundColor: color, color: caseTextColor(color), fontWeight: 600, filter: theme.caseColorFilter, padding: `0 ${Math.max(2, Math.round(8 * L.scale))}px` }}
        >
          {deadline.caseLabel}
        </span>
        {title && <><span className="text-muted-foreground"> · </span><span className="text-muted-foreground">{typeName}</span></>}
      </span>
    </>
  )
}

function CalendarChip({ deadline, ...ctx }: { deadline: Deadline } & Ctx) {
  const { L } = ctx
  return (
    <div
      data-testid="wallpaper-chip"
      className="flex flex-col rounded-sm overflow-hidden whitespace-nowrap"
      style={{
        borderLeft: `${L.bar}px solid ${ctx.caseColorOf(deadline.caseLabel)}`,
        padding: `${Math.round(4 * L.scale)}px ${Math.round(8 * L.scale)}px ${Math.round(4 * L.scale)}px ${Math.round(12 * L.scale)}px`,
      }}
    >
      <TitleBlock deadline={deadline} titleKey="chipTitle" metaKey="chipMeta" {...ctx} />
    </div>
  )
}

function RollingCalendar({ deadlines, today, todayStr, ...ctx }: {
  deadlines: Deadline[]
  today: Date
  todayStr: string
} & Ctx) {
  const { L, theme } = ctx
  const days = useMemo(() => {
    const start = startOfWeek(today, { weekStartsOn: WEEK_STARTS_ON })
    return Array.from({ length: L.weeks * 7 }, (_, i) => addDays(start, i))
  }, [today, L.weeks])
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

  const line = `${L.border}px solid var(--border)`
  return (
    <section data-testid="wallpaper-calendar" className="flex flex-col h-full min-h-0">
      <div className="grid grid-cols-7" style={{ marginBottom: `${Math.round(8 * L.scale)}px` }}>
        {weekdayLabels.map(label => (
          <div key={label} className="font-semibold text-muted-foreground" style={{ ...text(L, 'weekday'), padding: `0 ${Math.round(16 * L.scale)}px` }}>{label}</div>
        ))}
      </div>
      <div
        className="grid grid-cols-7 flex-1 min-h-0"
        style={{ gridTemplateRows: `repeat(${L.weeks}, minmax(0, 1fr))`, borderTop: line, borderLeft: line }}
      >
        {days.map((day, i) => {
          const iso = toISODateString(day)
          const isToday = iso === todayStr
          const isPast = iso < todayStr
          // Month name on the first cell and on the 1st of each month so the rolling range reads clearly
          const label = i === 0 || day.getDate() === 1 ? format(day, 'MMM d') : format(day, 'd')
          const items = byDate.get(iso) ?? []
          const shown = items.slice(0, L.maxPerCell)
          const hidden = items.length - shown.length
          return (
            <div
              key={iso}
              data-testid={`wallpaper-day-${iso}`}
              className={`flex flex-col min-h-0 overflow-hidden ${isPast ? 'opacity-40' : ''}`}
              style={{
                borderRight: line,
                borderBottom: line,
                padding: `${L.cellPad}px`,
                gap: `${L.cellGap}px`,
                ...(isToday ? { backgroundColor: theme.today.fill, boxShadow: `inset 0 0 0 ${L.todayRing}px ${theme.today.ring}` } : {}),
                ...(isPast ? { opacity: theme.pastOpacity } : {}),
              }}
            >
              <div className={isToday ? 'font-bold' : 'text-foreground'} style={{ ...text(L, 'dayNum'), ...(isToday ? { color: theme.today.text } : {}) }}>{label}</div>
              {shown.map(d => <CalendarChip key={d.id} deadline={d} {...ctx} />)}
              {hidden > 0 && <div className="text-muted-foreground" style={{ ...text(L, 'more'), paddingLeft: `${Math.round(12 * L.scale)}px` }}>+{hidden} more</div>}
            </div>
          )
        })}
      </div>
    </section>
  )
}

// List row: date column, then title over case · type
function ListRow({ deadline, ...ctx }: { deadline: Deadline } & Ctx) {
  const { L } = ctx
  return (
    <div
      className="flex items-start rounded-sm"
      style={{
        borderLeft: `${L.bar}px solid ${ctx.caseColorOf(deadline.caseLabel)}`,
        gap: `${Math.round(24 * L.scale)}px`,
        padding: `${Math.round(4 * L.scale)}px 0 ${Math.round(4 * L.scale)}px ${Math.round(16 * L.scale)}px`,
        marginBottom: `${Math.round(12 * L.scale)}px`,
      }}
    >
      <span className="shrink-0 tabular-nums text-muted-foreground" style={{ ...text(L, 'listDate'), width: `${L.listDateWidth}px` }}>
        {formatIso(deadline.date, 'EEE, MMM d')}
      </span>
      <div className="flex flex-col min-w-0 whitespace-nowrap">
        <TitleBlock deadline={deadline} titleKey="listTitle" metaKey="listMeta" {...ctx} />
      </div>
    </div>
  )
}

function BucketSection({ testid, title, titleColor, items, emptyText, limit, ...ctx }: {
  testid: string
  title: string
  titleColor?: string
  items: Deadline[]
  emptyText: string
  limit: number
} & Ctx) {
  const { L } = ctx
  const shown = items.slice(0, limit)
  const hidden = items.length - shown.length
  return (
    <div data-testid={testid} style={{ marginBottom: `${Math.round(40 * L.scale)}px` }}>
      <div style={{ paddingBottom: `${Math.round(8 * L.scale)}px`, borderBottom: `${L.border}px solid var(--border)`, marginBottom: `${Math.round(16 * L.scale)}px` }}>
        <div className={`font-semibold ${titleColor ? '' : 'text-foreground'}`} style={{ ...text(L, 'bucketTitle'), ...(titleColor ? { color: titleColor } : {}) }}>{title}</div>
      </div>
      {items.length === 0
        ? <p className="text-muted-foreground italic" style={text(L, 'empty')}>{emptyText}</p>
        : shown.map(d => <ListRow key={d.id} deadline={d} {...ctx} />)}
      {hidden > 0 && <p className="text-muted-foreground" style={{ ...text(L, 'empty'), paddingLeft: `${Math.round(16 * L.scale)}px` }}>+{hidden} more</p>}
    </div>
  )
}

const BUCKET_META: Record<Exclude<Bucket, 'overdue'>, { title: string; empty: string }> = {
  today: { title: 'TODAY', empty: 'Nothing due today.' },
  thisWeek: { title: 'THIS WEEK', empty: 'Nothing else this week.' },
  nextWeek: { title: 'NEXT WEEK', empty: 'Nothing next week.' },
  later: { title: 'LATER', empty: 'Nothing on the horizon.' },
}

/** Logical screen size: ?w=&h= when given (wallpaper worker), else the window. */
function screenSize(params: URLSearchParams): { width: number; height: number } {
  const w = Number(params.get('w'))
  const h = Number(params.get('h'))
  if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0) return { width: w, height: h }
  return { width: typeof window !== 'undefined' ? window.innerWidth : 1920, height: typeof window !== 'undefined' ? window.innerHeight : 1080 }
}

export function WallpaperView(): React.JSX.Element {
  const deadlinesQuery = useQuery({ queryKey: ['deadlines'], queryFn: getDeadlines })
  const { typesById, isLoading: typesLoading, isError: typesError } = useTypeColors()

  const [searchParams] = useSearchParams()
  // Theme: ?theme= (previews) > saved setting (Settings > Wallpaper) > default. If settings
  // can't be loaded, fall back to the default rather than failing the wallpaper.
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: getSettings, retry: false })
  // Emailed orders waiting for review: shown as a reminder so they can't be forgotten
  const inboxQuery = useQuery({ queryKey: ['email-imports'], queryFn: getEmailInbox, retry: false })
  const pendingEmails = inboxQuery.data?.items.filter(i => i.status === 'pending').length ?? 0
  const settings = settingsQuery.data
  const themeParam = searchParams.get('theme')
  const themeId = isWallpaperThemeId(themeParam) ? themeParam : (settings?.wallpaperTheme ?? DEFAULT_WALLPAPER_THEME)
  const theme = WALLPAPER_THEMES[themeId]
  const background = settings?.wallpaperBackground ?? null
  const canvas = theme.id === 'glass' && background ? glassCanvasWithImage(wallpaperBackgroundUrl(background.version)) : theme.canvas

  const { width, height } = screenSize(searchParams)
  const L = useMemo(
    () => computeWallpaperLayout({
      width,
      height,
      iconSide: settings?.wallpaperIconSide ?? 'left',
      iconColumns: settings?.wallpaperIconColumns ?? null,
    }),
    [width, height, settings?.wallpaperIconSide, settings?.wallpaperIconColumns]
  )

  // Capture a single Date at component mount so todayStr is always consistent.
  // new Date() no-arg is allowed - SAFE-03 guard narrows to string-arg forms only.
  const today = useMemo(() => new Date(), [])
  const todayStr = toISODateString(today)
  const deadlines = deadlinesQuery.data ?? []

  // ?t= -> "Last updated". SAFE-03: new Date(number) is allowed.
  const tParam = searchParams.get('t')
  const tNumber = tParam !== null && tParam !== '' ? Number(tParam) : NaN
  const lastUpdated = Number.isFinite(tNumber) ? new Date(tNumber) : new Date()
  const timestampStr = format(lastUpdated, "h:mm a 'on' MMM d, yyyy")

  // Display-only: completed deadlines are always hidden; past ones appear only (dimmed) on the calendar.
  const active = useMemo(() => deadlines.filter(d => d.completedAt === null), [deadlines])
  const buckets = useMemo(() => groupByBucket(active, todayStr), [active, todayStr])
  const baseCaseColorOf = useCaseColors()
  const darkBackground = theme.darkBackground
  const caseColorOf = useCallback(
    (label: string) => darkBackground ? liftForDarkBackground(baseCaseColorOf(label), darkBackground) : baseCaseColorOf(label),
    [baseCaseColorOf, darkBackground]
  )
  const ctx: Ctx = { typesById, caseColorOf, theme, L }
  const allEmpty = buckets.today.length + buckets.thisWeek.length + buckets.nextWeek.length + buckets.later.length === 0
  const limits = allocateListRows(L, {
    overdue: 0, today: buckets.today.length, thisWeek: buckets.thisWeek.length,
    nextWeek: buckets.nextWeek.length, later: buckets.later.length,
  })

  const rangeStart = startOfWeek(today, { weekStartsOn: WEEK_STARTS_ON })
  const rangeEnd = addDays(rangeStart, L.weeks * 7 - 1)

  if (deadlinesQuery.isLoading || typesLoading || settingsQuery.isLoading) {
    return <div className="animate-pulse bg-muted rounded h-4 w-40" />
  }
  if (deadlinesQuery.isError || typesError) {
    return <div className="text-red-700 p-8">Failed to load deadlines. Refresh the page.</div>
  }

  const side = L.mode === 'side'
  const columnsCss = side ? `minmax(0, 1fr) ${L.listWidth}px` : 'minmax(0, 1fr) auto'
  const listColumns = (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${L.listColumns.length}, minmax(0, 1fr))`, gap: `${L.gap}px`, height: '100%' }}>
      {L.listColumns.map((column, ci) => (
        <div key={ci} data-testid={`wallpaper-list-column-${ci}`} className="min-w-0 min-h-0 overflow-hidden">
          {column.map(b => {
            const bucket = b as Exclude<Bucket, 'overdue'>
            return (
              <BucketSection
                key={bucket}
                testid={`wallpaper-bucket-${bucket}`}
                title={BUCKET_META[bucket].title}
                titleColor={bucket === 'today' ? theme.today.text : undefined}
                items={buckets[bucket]}
                emptyText={BUCKET_META[bucket].empty}
                limit={limits[bucket]}
                {...ctx}
              />
            )
          })}
        </div>
      ))}
    </div>
  )

  return (
    <div
      data-testid="wallpaper-root"
      data-theme={theme.id}
      data-layout={L.mode}
      style={{
        width: `${L.width}px`,
        height: `${L.height}px`,
        overflow: 'hidden',
        background: canvas,
        fontFamily: 'var(--font-sans)',
        position: 'relative',
        padding: `${L.pad}px`,
        ...(L.gutter.side === 'left' ? { paddingLeft: `${L.pad + L.gutter.width}px` } : {}),
        ...(L.gutter.side === 'right' ? { paddingRight: `${L.pad + L.gutter.width}px` } : {}),
        display: 'flex',
        flexDirection: 'column',
        // Tailwind's text-foreground / text-muted-foreground / border-border read these
        ...(theme.vars as React.CSSProperties),
      }}
    >
      <div
        data-testid="wallpaper-surface"
        className="flex-1 min-h-0 flex flex-col"
        style={theme.panel ? {
          background: theme.panel.background,
          border: `1px solid ${theme.panel.border}`,
          borderRadius: `${Math.round(theme.panel.radiusPx * L.scale)}px`,
          padding: `${Math.round(theme.panel.paddingPx * L.scale)}px`,
          backdropFilter: `blur(${Math.round(theme.panel.blurPx * Math.max(0.5, L.scale))}px)`,
        } : undefined}
      >
        {/* Side layout: same two columns as the body, so today's date sits above the TODAY list */}
        <header
          className="items-baseline"
          style={{
            display: 'grid',
            gridTemplateColumns: columnsCss,
            gap: `${L.gap}px`,
            paddingBottom: `${Math.round(16 * L.scale)}px`,
            borderBottom: `${L.border}px solid var(--border)`,
            marginBottom: `${Math.round(32 * L.scale)}px`,
          }}
        >
          <div className="flex items-baseline" style={{ gap: `${Math.round(32 * L.scale)}px` }}>
            <div data-testid="wallpaper-range" className="font-semibold text-foreground" style={text(L, 'range')}>
              {format(rangeStart, 'MMM d')} – {format(rangeEnd, 'MMM d, yyyy')}
            </div>
            {pendingEmails > 0 && (
              <div data-testid="wallpaper-inbox-reminder" className="rounded-md font-semibold"
                style={{ ...text(L, 'reminder'), padding: `${Math.round(4 * L.scale)}px ${Math.round(16 * L.scale)}px`, backgroundColor: theme.today.fill, color: theme.today.text, boxShadow: `inset 0 0 0 ${L.border}px ${theme.today.ring}` }}>
                {pendingEmails === 1 ? '1 emailed order to review' : `${pendingEmails} emailed orders to review`}
              </div>
            )}
          </div>
          <div data-testid="wallpaper-today-date" className="text-muted-foreground" style={text(L, 'todayDate')}>
            {format(today, 'EEEE, MMMM d')}
          </div>
        </header>

        <div
          className="flex-1 min-h-0"
          style={side
            ? { display: 'grid', gridTemplateColumns: columnsCss, gap: `${L.gap}px`, paddingBottom: `${Math.round(32 * L.scale)}px` }
            : { display: 'grid', gridTemplateRows: `minmax(0, 1fr) ${L.stackedListHeight}px`, gap: `${L.gap}px`, paddingBottom: `${Math.round(32 * L.scale)}px` }}
        >
          <RollingCalendar deadlines={active} today={today} todayStr={todayStr} {...ctx} />
          <section data-testid="wallpaper-list" className="min-w-0 min-h-0 overflow-hidden">
            {allEmpty ? (
              <div className="flex flex-col items-center justify-center h-full" style={{ gap: `${Math.round(24 * L.scale)}px` }}>
                <CalendarIcon className="text-muted-foreground" style={{ width: `${Math.round(96 * L.scale)}px`, height: `${Math.round(96 * L.scale)}px` }} />
                <p className="text-muted-foreground" style={text(L, 'todayDate')}>All caught up — no upcoming deadlines</p>
              </div>
            ) : listColumns}
          </section>
        </div>
      </div>

      {/* Bottom-corner timestamp footer — always visible, away from the icon gutter side */}
      <span
        data-testid="wallpaper-timestamp"
        className="absolute text-muted-foreground"
        style={{
          ...text(L, 'footer'),
          bottom: `${Math.round(24 * L.scale)}px`,
          ...(L.gutter.side === 'right' ? { left: `${L.pad}px` } : { right: `${L.pad}px` }),
        }}
      >
        Last updated {timestampStr}
      </span>
    </div>
  )
}
