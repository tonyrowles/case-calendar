import React from 'react'
import { useFilters } from '@/client/hooks/useFilters.js'
import { Button } from '@/client/components/ui/button.js'
import { Switch } from '@/client/components/ui/switch.js'
import { CaseCombobox } from './CaseCombobox.js'
import { TypeFilter } from './TypeFilter.js'
import { DateRangeSelect } from './DateRangeSelect.js'

export function FilterBar(): React.JSX.Element {
  const { filters, isDefault, setShowCompleted, clearAll } = useFilters()

  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 h-14 px-4 bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60 border-b border-border">
      <CaseCombobox />
      <TypeFilter />
      <DateRangeSelect />
      {/* Show completed toggle — pushed right via ml-auto; before Clear */}
      <div className="flex items-center gap-2 ml-auto">
        <label
          htmlFor="show-completed"
          className="text-sm text-muted-foreground cursor-pointer select-none"
        >
          Show completed
        </label>
        <Switch
          id="show-completed"
          checked={filters.showCompleted}
          onCheckedChange={setShowCompleted}
          aria-label="Show completed deadlines"
        />
      </div>
      {!isDefault && (
        <Button
          variant="ghost"
          className="h-9 text-sm text-muted-foreground hover:text-foreground"
          aria-label="Clear all filters"
          onClick={clearAll}
        >
          Clear
        </Button>
      )}
    </div>
  )
}
