import React, { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { Copy } from 'lucide-react'
import { parseLocalDate } from '@/shared/lib/date.js'
import type { Bucket } from '@/shared/lib/buckets.js'
import type { Deadline, DeadlineType } from '@/shared/schemas/deadline.js'
import { CaseBadge } from '@/client/components/CaseBadge.js'

type DeleteStep = 'idle' | 'confirm' | 'executing'

export interface DeadlineRowProps {
  deadline: Deadline
  bucket: Bucket
  typesById: Map<number, DeadlineType>
  /** Case -> color (useCaseColors). Rows are color-coded by case, not by type. */
  caseColorOf: (caseLabel: string) => string
  /** Called when the row body is clicked (not the action buttons) */
  onRowClick?: (id: number) => void
  /** Called after 2nd confirm click on delete button.
   *  The second argument is a reset callback; callers must invoke it on failure
   *  to return the row from 'executing' to 'idle' (WR-01). */
  onDelete?: (id: number, onError: () => void) => void
  /** Called when the Duplicate row-action is clicked (POLISH-04) */
  onDuplicate?: (id: number) => void
  /** When set, this row shows the selected-row highlight */
  selectedDeadlineId?: number | null
  /** Keyboard delete signal (KBD-03): when nonce changes and id matches, advance deleteStep idle→confirm.
   *  The 2-step UX is preserved — user must press Delete a second time to confirm deletion. */
  deleteTriggerSignal?: { id: number; nonce: number } | null
}

export function DeadlineRow({
  deadline,
  bucket,
  typesById,
  caseColorOf,
  onRowClick,
  onDelete,
  onDuplicate,
  selectedDeadlineId,
  deleteTriggerSignal,
}: DeadlineRowProps): React.JSX.Element {
  const parsedDate = parseLocalDate(deadline.date)
  const formattedDate = parsedDate ? format(parsedDate, 'MMM d, yyyy') : deadline.date
  const typeName = typesById.get(deadline.typeId)?.name ?? 'Unknown'

  // A deadline view, not a task list: no done/overdue states. Today stands out; past
  // entries (the Past view) are quieter.
  const isToday = bucket === 'today'
  const isPast = bucket === 'overdue'
  const isSelected = selectedDeadlineId === deadline.id

  // 2-step delete confirm state
  const [deleteStep, setDeleteStep] = useState<DeleteStep>('idle')
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Shared step-advance logic used by both mouse Delete button and keyboard Delete shortcut.
   *  idle → confirm: prime the 2-step UX.
   *  confirm → executing: trigger the actual deletion (mirrors mouse confirm-click path). */
  function advanceDelete() {
    if (deleteStep === 'idle') {
      setDeleteStep('confirm')
    } else if (deleteStep === 'confirm') {
      setDeleteStep('executing')
      onDelete?.(deadline.id, () => setDeleteStep('idle'))
    }
  }

  // Keyboard delete signal: when nonce changes AND id matches, advance the delete step machine (KBD-03).
  // Only advances one step per nonce change — user must fire Delete again to confirm.
  useEffect(() => {
    if (!deleteTriggerSignal || deleteTriggerSignal.id !== deadline.id) return
    advanceDelete()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deleteTriggerSignal?.nonce])

  // 8-second timeout to reset from 'confirm' to 'idle' (Common Pitfall #10)
  useEffect(() => {
    if (deleteStep === 'confirm') {
      deleteTimeoutRef.current = setTimeout(() => {
        setDeleteStep('idle')
      }, 8000)
    }
    return () => {
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current)
        deleteTimeoutRef.current = null
      }
    }
  }, [deleteStep])

  // Escape key resets confirm state (scoped to when not idle)
  useEffect(() => {
    if (deleteStep === 'idle') return
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setDeleteStep('idle')
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [deleteStep])

  // Selected row highlight classes
  let selectedClass = ''
  if (isSelected) {
    if (isToday) {
      selectedClass = 'outline outline-1 outline-primary/40 -outline-offset-1'
    } else {
      selectedClass = 'bg-primary/10'
    }
  }

  const caseColor = caseColorOf(deadline.caseLabel)

  // Left bar = case color on every row; today is signalled by row tint + date color.
  const containerClass = [
    'group relative flex items-center h-12 gap-4 border-b border-border last:border-b-0',
    'border-l-4 pl-3 pr-4 transition-colors cursor-pointer',
    isToday ? 'bg-amber-50 hover:bg-amber-100' : 'hover:bg-muted/50',
    isPast ? 'opacity-70' : '',
    selectedClass,
  ]
    .filter(Boolean)
    .join(' ')

  const dateClass = [
    'w-[120px] shrink-0 text-sm',
    isToday ? 'text-amber-700 font-semibold' : 'text-muted-foreground',
  ]
    .filter(Boolean)
    .join(' ')

  const caseLabelClass = 'text-sm flex-1 min-w-0'

  const ariaLabel = `${deadline.caseLabel}, ${typeName}, ${isPast ? 'was due' : 'due'} ${formattedDate}`

  return (
    <div
      role="row"
      aria-label={ariaLabel}
      className={containerClass}
      style={{ borderLeftColor: caseColor }}
      onClick={() => onRowClick?.(deadline.id)}
    >
      {/* Date */}
      <span className={dateClass}>
        {formattedDate}
      </span>

      {/* Case label — badge in the case color */}
      <span className={caseLabelClass}>
        <CaseBadge label={deadline.caseLabel} color={caseColor} />
      </span>

      {/* Type: name only (color now belongs to the case) */}
      <span className="w-[180px] shrink-0 text-sm text-foreground truncate">
        {typeName}
      </span>

      {/* Description */}
      <span className="flex-1 min-w-0 text-sm text-muted-foreground truncate">
        {deadline.description ? (
          deadline.description
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </span>

      {/* Duplicate button — hidden until row hover or focus-visible (POLISH-04). Only during idle delete-step. */}
      {deleteStep === 'idle' && onDuplicate && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDuplicate(deadline.id)
          }}
          className="shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity h-7 px-2 text-sm text-muted-foreground hover:text-foreground rounded"
          aria-label={`Duplicate ${deadline.caseLabel}`}
        >
          <Copy className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}

      {/* Delete button — 2-step inline confirm; hidden until row hover or focus-visible (Pitfall 7) */}
      {deleteStep === 'idle' && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            advanceDelete()
          }}
          className="shrink-0 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity h-7 px-2 text-sm text-muted-foreground hover:text-destructive rounded"
          aria-label={`Delete deadline ${deadline.caseLabel}`}
        >
          Delete
        </button>
      )}
      {deleteStep === 'confirm' && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            advanceDelete()
          }}
          onBlur={() => setDeleteStep('idle')}
          className="shrink-0 h-7 px-2 text-sm text-destructive font-semibold hover:bg-destructive/10 rounded"
          aria-label={`Confirm delete deadline ${deadline.caseLabel}`}
        >
          Are you sure?
        </button>
      )}
      {deleteStep === 'executing' && (
        <button
          type="button"
          disabled
          className="shrink-0 h-7 px-2 text-sm text-muted-foreground rounded"
          aria-disabled="true"
        >
          Confirm Delete
        </button>
      )}
    </div>
  )
}
