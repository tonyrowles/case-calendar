import React from 'react'
import { ChevronDown } from 'lucide-react'
import { useFilters } from '@/client/hooks/useFilters.js'
import { useTypeColors } from '@/client/hooks/useTypeColors.js'
import { Popover, PopoverContent, PopoverTrigger } from '@/client/components/ui/popover.js'
import { Button } from '@/client/components/ui/button.js'
import { Checkbox } from '@/client/components/ui/checkbox.js'
import { cn } from '@/client/lib/utils.js'

export function TypeFilter(): React.JSX.Element {
  const { filters, setTypeIds } = useFilters()
  const { types, getColor } = useTypeColors()

  function toggle(id: number, checked: boolean): void {
    const current = filters.typeIds
    const next = checked
      ? [...current, id]
      : current.filter(existing => existing !== id)
    setTypeIds(next)
  }

  const hasSelection = filters.typeIds.length > 0

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          aria-label="Filter by deadline type"
          className={cn(
            'h-9 min-w-[90px] justify-between',
            hasSelection ? 'bg-secondary text-foreground' : ''
          )}
        >
          {hasSelection ? `Types (${filters.typeIds.length})` : 'Types'}
          <ChevronDown className="size-4 ml-1 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-2" aria-label="Deadline type filter">
        <div className="flex flex-col gap-1">
          {types.map(t => (
            <label
              key={t.id}
              role="menuitemcheckbox"
              aria-checked={filters.typeIds.includes(t.id)}
              className="flex items-center gap-2 px-2 py-2 rounded-sm hover:bg-muted/50 cursor-pointer"
            >
              <Checkbox
                checked={filters.typeIds.includes(t.id)}
                onCheckedChange={(checked) => toggle(t.id, !!checked)}
              />
              <span
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: getColor(t.id) }}
                aria-hidden="true"
              />
              <span className="text-sm text-foreground flex-1">{t.name}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
