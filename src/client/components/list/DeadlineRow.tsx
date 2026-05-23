import React, { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { parseLocalDate } from '@/shared/lib/date.js'
import type { Bucket } from '@/shared/lib/buckets.js'
import type { Deadline, DeadlineType } from '@/shared/schemas/deadline.js'
import { Checkbox } from '@/client/components/ui/checkbox.js'

type DeleteStep = 'idle' | 'confirm' | 'executing'

export interface DeadlineRowProps {
  deadline: Deadline
  bucket: Bucket
  typesById: Map<number, DeadlineType>
  getColor: (id: number) => string
  /** Called when the row body is clicked (not checkbox, not delete button) */
  onRowClick?: (id: number) => void
  /** Called when checkbox is toggled; completed=true → mark complete, false → unmark */
  onComplete?: (id: number, completed: boolean) => void
  /** Called after 2nd confirm click on delete button */
  onDelete?: (id: number) => void
  /** When set, this row shows the selected-row highlight */
  selectedDeadlineId?: number | null
}

export function DeadlineRow({
  deadline,
  bucket,
  typesById,
  getColor,
  onRowClick,
  onComplete,
  onDelete,
  selectedDeadlineId,
}: DeadlineRowProps): React.JSX.Element {
  const parsedDate = parseLocalDate(deadline.date)
  const formattedDate = parsedDate ? format(parsedDate, 'MMM d, yyyy') : deadline.date
  const typeName = typesById.get(deadline.typeId)?.name ?? 'Unknown'

  const isOverdue = bucket === 'overdue'
  const isToday = bucket === 'today'
  const isCompleted = deadline.completedAt !== null
  const isSelected = selectedDeadlineId === deadline.id

  // 2-step delete confirm state
  const [deleteStep, setDeleteStep] = useState<DeleteStep>('idle')
  const deleteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
    if (isOverdue || isToday) {
      selectedClass = 'outline outline-1 outline-primary/40 -outline-offset-1'
    } else {
      selectedClass = 'bg-primary/5'
    }
  }

  const containerClass = [
    'group relative flex items-center h-12 gap-4 border-b border-border last:border-0',
    'transition-colors cursor-pointer',
    isOverdue ? 'bg-red-50 border-l-4 border-l-red-700 pl-3 pr-4 hover:bg-red-100' : '',
    isToday ? 'bg-amber-50 border-l-4 border-l-amber-500 pl-3 pr-4 hover:bg-amber-100' : '',
    !isOverdue && !isToday ? 'px-4 hover:bg-muted/50' : '',
    isCompleted ? 'opacity-50' : '',
    selectedClass,
  ]
    .filter(Boolean)
    .join(' ')

  const caseLabelClass = [
    'text-sm flex-1 min-w-0 truncate',
    isOverdue ? 'text-red-700' : '',
    isToday ? 'text-amber-700' : '',
    !isOverdue && !isToday ? 'text-foreground' : '',
    isCompleted ? 'line-through' : '',
  ]
    .filter(Boolean)
    .join(' ')

  const ariaLabel = [
    `${deadline.caseLabel}, ${typeName}, due ${formattedDate}`,
    isOverdue ? ', overdue' : '',
    isCompleted ? ', completed' : '',
  ].join('')

  return (
    <div
      role="row"
      aria-label={ariaLabel}
      data-completed={isCompleted ? 'true' : undefined}
      className={containerClass}
      onClick={() => onRowClick?.(deadline.id)}
    >
      {/* Checkbox — click stops propagation so row-click doesn't fire */}
      <Checkbox
        checked={isCompleted}
        onCheckedChange={(checked) => {
          onComplete?.(deadline.id, !!checked)
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Mark ${deadline.caseLabel} ${isCompleted ? 'incomplete' : 'complete'}`}
        className="shrink-0 w-5 h-5"
      />

      {/* Date */}
      <span className="w-[120px] shrink-0 text-sm text-muted-foreground">
        {formattedDate}
      </span>

      {/* Case label */}
      <span className={caseLabelClass}>
        {deadline.caseLabel}
      </span>

      {/* Type: color dot + name */}
      <span className="w-[180px] shrink-0 flex items-center gap-2 text-sm text-foreground">
        <span
          className="w-3 h-3 rounded-full inline-block shrink-0"
          style={{ backgroundColor: getColor(deadline.typeId) }}
          aria-hidden="true"
        />
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

      {/* Delete button — 2-step inline confirm; hidden until row hover */}
      {deleteStep === 'idle' && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setDeleteStep('confirm')
          }}
          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity h-7 px-2 text-sm text-muted-foreground hover:text-destructive rounded"
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
            setDeleteStep('executing')
            onDelete?.(deadline.id)
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
