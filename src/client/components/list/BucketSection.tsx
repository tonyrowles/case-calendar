import React, { useState, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Bucket } from '@/shared/lib/buckets.js'
import type { Deadline, DeadlineType } from '@/shared/schemas/deadline.js'
import { DeadlineRow } from './DeadlineRow.js'

export interface BucketSectionProps {
  bucketId: Bucket
  bucketLabel: string
  deadlines: Deadline[]
  typesById: Map<number, DeadlineType>
  getColor: (id: number) => string
  onRowClick?: (id: number) => void
  onComplete?: (id: number, completed: boolean) => void
  onDelete?: (id: number) => void
  selectedDeadlineId?: number | null
}

export function BucketSection({
  bucketId,
  bucketLabel,
  deadlines,
  typesById,
  getColor,
  onRowClick,
  onComplete,
  onDelete,
  selectedDeadlineId,
}: BucketSectionProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(true)

  // Reset to open whenever the bucket's deadline count changes (filter change)
  // This prevents filtered results from being hidden behind a collapsed bucket.
  useEffect(() => {
    setIsOpen(true)
  }, [deadlines.length])

  const bodyId = `bucket-${bucketId}-body`

  return (
    <div>
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={bodyId}
        onClick={() => setIsOpen(prev => !prev)}
        className="w-full flex items-center h-10 px-4 gap-2 border-b border-border hover:bg-muted/50 transition-colors"
      >
        <span className="text-xl font-semibold text-foreground">{bucketLabel}</span>
        <span className="text-sm text-muted-foreground">{deadlines.length}</span>
        <ChevronDown
          className={`size-4 text-muted-foreground ml-auto transition-transform duration-150${isOpen ? '' : ' -rotate-90'}`}
        />
      </button>

      {isOpen && (
        <div
          id={bodyId}
          role="rowgroup"
          aria-label={`${bucketLabel} deadlines`}
        >
          {deadlines.map(deadline => (
            <DeadlineRow
              key={deadline.id}
              deadline={deadline}
              bucket={bucketId}
              typesById={typesById}
              getColor={getColor}
              onRowClick={onRowClick}
              onComplete={onComplete}
              onDelete={onDelete}
              selectedDeadlineId={selectedDeadlineId}
            />
          ))}
        </div>
      )}
    </div>
  )
}
