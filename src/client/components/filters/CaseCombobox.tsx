import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, ChevronDown } from 'lucide-react'
import { getCaseLabels } from '@/client/lib/api.js'
import { useFilters } from '@/client/hooks/useFilters.js'
import { Popover, PopoverContent, PopoverTrigger } from '@/client/components/ui/popover.js'
import { Button } from '@/client/components/ui/button.js'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/client/components/ui/command.js'
import { cn } from '@/client/lib/utils.js'

export function CaseCombobox(): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const { filters, setCase } = useFilters()

  const labelsQuery = useQuery({
    queryKey: ['case-labels'],
    queryFn: getCaseLabels,
  })

  function handleSelect(label: string): void {
    // Toggle: selecting the already-selected label clears the filter
    setCase(filters.case === label ? null : label)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-label="Filter by case"
          className={cn(
            'h-9 max-w-[180px] truncate justify-between',
            filters.case ? 'bg-secondary text-foreground' : ''
          )}
        >
          {filters.case ?? 'Case'}
          <ChevronDown className="size-4 ml-1 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="start">
        <Command aria-label="Case filter">
          <CommandInput placeholder="Search cases…" />
          <CommandList>
            <CommandEmpty>
              {labelsQuery.isLoading ? 'Loading…' : 'No cases found.'}
            </CommandEmpty>
            <CommandGroup>
              {labelsQuery.data?.map(label => (
                <CommandItem
                  key={label}
                  value={label}
                  onSelect={() => handleSelect(label)}
                >
                  {filters.case === label && (
                    <Check className="size-4 mr-2 shrink-0" />
                  )}
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
