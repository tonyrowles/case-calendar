import React, { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, RotateCcw } from 'lucide-react'

import { getCaseColors, getCaseLabels, resetCaseColor, setCaseColor } from '@/client/lib/api.js'
import { useCaseColors } from '@/client/hooks/useCaseColors.js'
import { CASE_PALETTE, caseColorKey, caseTextColor } from '@/shared/lib/case-colors.js'
import { CaseBadge } from '@/client/components/CaseBadge.js'
import { Button } from '@/client/components/ui/button.js'
import { Popover, PopoverContent, PopoverTrigger } from '@/client/components/ui/popover.js'
import { cn } from '@/client/lib/utils.js'

/**
 * Settings > Cases: every case with its current color. A case's color is automatic
 * until the user picks one from the palette; "Use automatic color" removes the choice.
 * Colors apply everywhere at once (list, filters, case picker, wallpaper).
 */
export function CaseColorList(): React.JSX.Element {
  const queryClient = useQueryClient()
  const labelsQuery = useQuery({ queryKey: ['case-labels'], queryFn: getCaseLabels })
  const overridesQuery = useQuery({ queryKey: ['case-colors'], queryFn: getCaseColors, retry: false })
  const caseColorOf = useCaseColors()
  const [error, setError] = useState<string | null>(null)

  const customKeys = useMemo(
    () => new Set((overridesQuery.data ?? []).map(o => caseColorKey(o.caseLabel))),
    [overridesQuery.data]
  )

  const onDone = {
    onSuccess: () => {
      setError(null)
      queryClient.invalidateQueries({ queryKey: ['case-colors'] })
    },
    onError: (err: Error) => setError(err.message),
  }
  const setMutation = useMutation({
    mutationFn: ({ caseLabel, color }: { caseLabel: string; color: string }) => setCaseColor(caseLabel, color),
    ...onDone,
  })
  const resetMutation = useMutation({ mutationFn: resetCaseColor, ...onDone })

  if (labelsQuery.isError) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <p className="text-sm text-destructive">Couldn't load cases. Refresh the page.</p>
      </div>
    )
  }

  const labels = labelsQuery.data ?? []
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {error && (
        <p role="alert" className="px-4 py-2 text-sm text-destructive border-b border-border">{error}</p>
      )}
      {labelsQuery.isLoading && (
        <div className="h-12 flex items-center px-4"><div className="animate-pulse bg-muted rounded h-4 w-40" /></div>
      )}
      {!labelsQuery.isLoading && labels.length === 0 && (
        <p className="px-4 py-3 text-sm text-muted-foreground">No cases yet. Cases appear here once a deadline uses them.</p>
      )}
      {labels.map(label => (
        <CaseColorRow
          key={label}
          label={label}
          color={caseColorOf(label)}
          isCustom={customKeys.has(caseColorKey(label))}
          onPick={color => setMutation.mutate({ caseLabel: label, color })}
          onReset={() => resetMutation.mutate(label)}
        />
      ))}
    </div>
  )
}

function CaseColorRow({ label, color, isCustom, onPick, onReset }: {
  label: string
  color: string
  isCustom: boolean
  onPick: (color: string) => void
  onReset: () => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <div
      data-testid="case-color-row"
      className="h-12 flex items-center gap-3 px-4 border-b border-border last:border-b-0"
    >
      <span className="flex-1 min-w-0"><CaseBadge label={label} color={color} className="text-sm" /></span>
      <span className="text-xs text-muted-foreground w-20 text-right">{isCustom ? 'Custom' : 'Automatic'}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" aria-label={`Change color for ${label}`}>Change color</Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="end">
          <div role="group" aria-label={`Colors for ${label}`} className="grid grid-cols-5 gap-2">
            {CASE_PALETTE.map(hex => (
              <button
                key={hex}
                type="button"
                aria-label={`Use color ${hex}`}
                aria-pressed={hex === color}
                onClick={() => { onPick(hex); setOpen(false) }}
                className={cn(
                  'w-8 h-8 rounded-md ring-1 ring-black/10 flex items-center justify-center',
                  'hover:ring-2 hover:ring-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground',
                  hex === color && 'ring-2 ring-foreground'
                )}
                style={{ backgroundColor: hex, color: caseTextColor(hex) }}
              >
                {hex === color && <Check className="size-4" aria-hidden="true" />}
              </button>
            ))}
          </div>
          {isCustom && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-3 w-full justify-start text-muted-foreground"
              onClick={() => { onReset(); setOpen(false) }}
            >
              <RotateCcw className="size-4 mr-2" aria-hidden="true" />
              Use automatic color
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
