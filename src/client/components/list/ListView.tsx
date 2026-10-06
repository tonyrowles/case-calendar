import React from 'react'
import { groupByBucket } from '@/shared/lib/buckets.js'
import type { Bucket } from '@/shared/lib/buckets.js'
import type { Deadline } from '@/shared/schemas/deadline.js'
import { useTypeColors } from '@/client/hooks/useTypeColors.js'
import { useCaseColors } from '@/client/hooks/useCaseColors.js'
import { EmptyState } from '@/client/components/EmptyState.js'
import { BucketSection } from './BucketSection.js'

// The 'overdue' bucket holds past deadlines; the list only shows it in the Past view
const BUCKET_LABELS: Record<Bucket, string> = {
  overdue: 'Past',
  today: 'Today',
  thisWeek: 'This Week',
  nextWeek: 'Next Week',
  later: 'Later',
}

const UPCOMING_ORDER: Bucket[] = ['today', 'thisWeek', 'nextWeek', 'later']

export interface ListViewProps {
  deadlines: Deadline[] | undefined
  isLoading: boolean
  isError: boolean
  filtersActive: boolean
  todayStr: string
  /** Date range is Past: one "Past" section, most recent first */
  pastView?: boolean
  onRowClick?: (id: number) => void
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
  pastView = false,
  onRowClick,
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

  // Group deadlines into buckets (the filters already dropped past ones unless pastView)
  const buckets = groupByBucket(deadlines ?? [], todayStr)
  if (pastView) buckets.overdue.reverse()   // most recent first
  const order: Bucket[] = pastView ? ['overdue'] : UPCOMING_ORDER
  const nonEmptyBuckets = order.filter(b => buckets[b].length > 0)

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
          <p className="text-sm text-muted-foreground">
            {pastView
              ? 'No past deadlines match your filters.'
              : filtersActive
                ? 'No upcoming deadlines match your filters.'
                : 'Nothing coming up. Past deadlines are under Date: Past.'}
          </p>
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
          onDelete={onDelete}
          onDuplicate={onDuplicate}
          selectedDeadlineId={selectedDeadlineId}
          deleteTriggerSignal={deleteTriggerSignal}
        />
      ))}
    </div>
  )
}
