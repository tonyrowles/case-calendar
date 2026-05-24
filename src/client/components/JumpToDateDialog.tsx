import React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/client/components/ui/dialog.js'
import { Calendar } from '@/client/components/ui/calendar.js'
import { toISODateString } from '@/shared/lib/date.js'

export interface JumpToDateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Called with 'YYYY-MM-DD' when user picks a date. */
  onDateSelect: (isoDateStr: string) => void
}

export function JumpToDateDialog({
  open,
  onOpenChange,
  onDateSelect,
}: JumpToDateDialogProps): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Go to date</DialogTitle>
          <DialogDescription className="sr-only">
            Select a date to navigate the calendar to that month
          </DialogDescription>
        </DialogHeader>
        {/* data-testid on wrapper div because Calendar does not forward arbitrary DOM attributes */}
        <div data-testid="jump-to-date-calendar">
          <Calendar
            mode="single"
            onSelect={(date) => {
              if (date) {
                // toISODateString uses local-time getters — SAFE-03 compliant
                onDateSelect(toISODateString(date))
                onOpenChange(false)
              }
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  )
}
