import React from 'react'
import { groupByBucket } from '@/shared/lib/buckets.js'
import type { Bucket } from '@/shared/lib/buckets.js'
import type { Deadline } from '@/shared/schemas/deadline.js'
import { useTypeColors } from '@/client/hooks/useTypeColors.js'
import { useCaseColors } from '@/client/hooks/useCaseColors.js'
import { EmptyState } from '@/client/components/EmptyState.js'
import { BucketSection } from './BucketSection.js'

const BUCKET_LABELS: Record<Bucket, string> = {
  overdue: 'Overdue',
  today: 'Today',
  thisWeek: 'This Week',
  nextWeek: 'Next Week',
  later: 'Later',
}

const BUCKET_ORDER: Bucket[] = ['overdue', 'today', 'thisWeek', 'nextWeek', 'later']

export interface ListViewProps {
  deadlines: Deadline[] | undefined
  isLoading: boolean
  isError: boolean
  filtersActive: boolean
  todayStr: string
  onRowClick?: (id: number) => void
  onComplete?: (id: number, completed: boolean) => void
  onDelete?: (id: number, onError: () => void) => void
  /** Forwarded to each DeadlineRow for the Duplicate row action (POLISH-04) */
  onDuplicate?: (id: number) => void
  selectedDeadlineId?: number | null
  /** Forwarded to each DeadlineRow for keyboard-driven 2-step delete (KBD-03) */
  deleteTriggerSignal?: { id: number; nonce: number } | null
}

export function ListView({
  deadlines,
  isLoading,
  isError,
  filtersActive,
  todayStr,
  onRowClick,
  onComplete,
  onDelete,
  onDuplicate,
  selectedDeadlineId,
  deleteTriggerSignal,
}: ListViewProps): React.JSX.Element {
  const { typesById } = useTypeColors()
  const caseColorOf = useCaseColors()

  if (isLoading) {
    return (
      <div
        role="table"
        aria-label="Loading deadlines"
        aria-busy="true"
        className="rounded-lg border bg-card mt-8 overflow-hidden"
      >
        {[1, 2, 3].map(i => (
          <div key={i} className="h-12 flex items-center gap-4 px-4 border-b border-border">
            <div className="animate-pulse bg-muted rounded h-4 w-20" />
            <div className="animate-pulse bg-muted rounded h-4 w-40" />
            <div className="animate-pulse bg-muted rounded h-4 w-28" />
            <div className="animate-pulse bg-muted rounded h-4 flex-1" />
          </div>
        ))}
      </div>
    )
  }

  if (isError) {
    return (
      <div
        role="table"
        aria-label="Deadlines list"
        className="rounded-lg border bg-card mt-8 overflow-hidden"
      >
        <div className="text-destructive text-sm text-center py-8 px-4">
          Couldn't load deadlines. Refresh the page.
        </div>
      </div>
    )
  }

  // Group deadlines into buckets
  const buckets = groupByBucket(deadlines ?? [], todayStr)
  const nonEmptyBuckets = BUCKET_ORDER.filter(b => buckets[b].length > 0)

  // Empty state: no deadlines at all (no filters active)
  if ((deadlines ?? []).length === 0 && !filtersActive) {
    return (
      <div
        role="table"
        aria-label="Deadlines list"
        className="rounded-lg border bg-card mt-8 overflow-hidden"
      >
        <EmptyState />
      </div>
    )
  }

  // Empty state: filters active, no matching results
  if (nonEmptyBuckets.length === 0) {
    return (
      <div
        role="table"
        aria-label="Deadlines list"
        className="rounded-lg border bg-card mt-8 overflow-hidden"
      >
        <div className="flex flex-col items-center py-12 px-4 gap-3">
          <p className="text-sm text-muted-foreground">No deadlines match your filters.</p>
        </div>
      </div>
    )
  }

  return (
    <div
      role="table"
      aria-label="Deadlines list"
      className="rounded-lg border bg-card mt-8 overflow-hidden"
    >
      {nonEmptyBuckets.map(bucketId => (
        <BucketSection
          key={bucketId}
          bucketId={bucketId}
          bucketLabel={BUCKET_LABELS[bucketId]}
          deadlines={buckets[bucketId]}
          typesById={typesById}
          caseColorOf={caseColorOf}
          onRowClick={onRowClick}
          onComplete={onComplete}
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          selectedDeadlineId={selectedDeadlineId}
          deleteTriggerSignal={deleteTriggerSignal}
        />
      ))}
    </div>
  )
}
