import React from 'react'
import { useFilters, type DateRange } from '@/client/hooks/useFilters.js'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/client/components/ui/select.js'

export function DateRangeSelect(): React.JSX.Element {
  const { filters, setRange } = useFilters()

  return (
    <Select
      value={filters.range}
      onValueChange={(v) => setRange(v as DateRange)}
    >
      <SelectTrigger
        className="h-9 w-[140px]"
        aria-label="Date range filter"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Upcoming</SelectItem>
        <SelectItem value="today">Today</SelectItem>
        <SelectItem value="this-week">This Week</SelectItem>
        <SelectItem value="this-month">This Month</SelectItem>
        <SelectItem value="past">Past</SelectItem>
      </SelectContent>
    </Select>
  )
}
