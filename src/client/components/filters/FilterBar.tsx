import React from 'react'
import { useFilters } from '@/client/hooks/useFilters.js'
import { Button } from '@/client/components/ui/button.js'
import { CaseCombobox } from './CaseCombobox.js'
import { TypeFilter } from './TypeFilter.js'
import { DateRangeSelect } from './DateRangeSelect.js'

export function FilterBar(): React.JSX.Element {
  const { isDefault, clearAll } = useFilters()

  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 h-14 px-4 bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60 border-b border-border">
      <CaseCombobox />
      <TypeFilter />
      <DateRangeSelect />
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
