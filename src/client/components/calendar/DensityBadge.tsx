import React from 'react'

/**
 * Phase 7 POLISH-03: Density badge for overflowed calendar day cells.
 *
 * IMPORTANT — RESEARCH Finding 1: FullCalendar's `MoreLinkContentArg` has shape
 * { num, text, shortText, view } — no `date` property. The UI-SPEC's planned
 * date-in-aria-label format requires a `moreLinkDidMount` workaround. We use the
 * simpler RESEARCH-recommended aria-label format (count only); FC's day-cell
 * structure already provides date context to screen readers via the surrounding grid.
 */
export interface DensityBadgeProps {
  count: number
}

export function DensityBadge({ count }: DensityBadgeProps): React.JSX.Element {
  const label = `${count} more deadline${count === 1 ? '' : 's'}`
  return (
    <span
      className="density-badge bg-muted text-muted-foreground rounded-full px-2 py-1 text-xs font-semibold"
      aria-label={label}
    >
      +{count}
    </span>
  )
}
