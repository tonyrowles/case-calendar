import React from 'react'
import { caseTextColor } from '@/shared/lib/case-colors.js'
import { cn } from '@/client/lib/utils.js'

/** Case name on a fill of its case color, with black/white text for contrast. */
export function CaseBadge({ label, color, className }: {
  label: string
  color: string
  className?: string
}): React.JSX.Element {
  return (
    <span
      data-testid="case-badge"
      className={cn('inline-block max-w-full truncate rounded-sm px-1.5 align-middle font-semibold', className)}
      style={{ backgroundColor: color, color: caseTextColor(color) }}
    >
      {label}
    </span>
  )
}

/** Small round swatch of a case color (for pickers and filters). */
export function CaseSwatch({ color }: { color: string }): React.JSX.Element {
  return (
    <span
      className="w-3 h-3 rounded-full inline-block shrink-0 ring-1 ring-black/10"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  )
}
