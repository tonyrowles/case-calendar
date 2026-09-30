import React, { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Archive, ArchiveRestore, Check, ChevronDown, ChevronRight, Pencil, RotateCcw } from 'lucide-react'

import {
  getCaseColors,
  getCases,
  renameCase,
  resetCaseColor,
  setCaseArchived,
  setCaseColor,
} from '@/client/lib/api.js'
import { useCaseColors } from '@/client/hooks/useCaseColors.js'
import { CASE_PALETTE, caseColorKey, caseTextColor } from '@/shared/lib/case-colors.js'
import { canonicalizeCaseLabel, findExistingCase } from '@/shared/lib/case-labels.js'
import type { CaseSummary } from '@/shared/schemas/cases.js'
import { CaseBadge } from '@/client/components/CaseBadge.js'
import { CaseLabelInput } from '@/client/components/CaseLabelInput.js'
import { Button } from '@/client/components/ui/button.js'
import { Popover, PopoverContent, PopoverTrigger } from '@/client/components/ui/popover.js'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog.js'
import { cn } from '@/client/lib/utils.js'

/**
 * Settings > Cases: every case with its open-deadline count and color.
 * - Change color: pick from the palette, or go back to the automatic color.
 * - Rename: fixes a case name on all its deadlines; renaming onto another existing case
 *   merges the two (the dialog says so first).
 * - Archive: hides a closed case from the case picker and filter. Its deadlines still
 *   show everywhere; archived cases with open deadlines are flagged.
 */
export function CaseList(): React.JSX.Element {
  const queryClient = useQueryClient()
  const casesQuery = useQuery({ queryKey: ['cases'], queryFn: getCases })
  const overridesQuery = useQuery({ queryKey: ['case-colors'], queryFn: getCaseColors, retry: false })
  const caseColorOf = useCaseColors()
  const [error, setError] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [showArchived, setShowArchived] = useState(false)

  const customKeys = useMemo(
    () => new Set((overridesQuery.data ?? []).map(o => caseColorKey(o.caseLabel))),
    [overridesQuery.data]
  )

  const refresh = () => {
    setError(null)
    for (const key of ['cases', 'case-labels', 'case-colors', 'deadlines']) {
      queryClient.invalidateQueries({ queryKey: [key] })
    }
  }
  const onError = (err: Error) => setError(err.message)
  const colorMutation = useMutation({
    mutationFn: ({ caseLabel, color }: { caseLabel: string; color: string | null }) =>
      color === null ? resetCaseColor(caseLabel) : setCaseColor(caseLabel, color).then(() => undefined),
    onSuccess: refresh,
    onError,
  })
  const archiveMutation = useMutation({
    mutationFn: ({ caseLabel, archived }: { caseLabel: string; archived: boolean }) => setCaseArchived(caseLabel, archived),
    onSuccess: refresh,
    onError,
  })

  if (casesQuery.isError) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <p className="text-sm text-destructive">Couldn't load cases. Refresh the page.</p>
      </div>
    )
  }

  const all = casesQuery.data ?? []
  const active = all.filter(c => !c.archived)
  const archived = all.filter(c => c.archived)

  const row = (c: CaseSummary) => (
    <CaseRow
      key={c.caseLabel}
      summary={c}
      color={caseColorOf(c.caseLabel)}
      isCustom={customKeys.has(caseColorKey(c.caseLabel))}
      onPickColor={color => colorMutation.mutate({ caseLabel: c.caseLabel, color })}
      onRename={() => setRenaming(c.caseLabel)}
      onArchive={value => archiveMutation.mutate({ caseLabel: c.caseLabel, archived: value })}
    />
  )

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card overflow-hidden">
        {error && (
          <p role="alert" className="px-4 py-2 text-sm text-destructive border-b border-border">{error}</p>
        )}
        {casesQuery.isLoading && (
          <div className="h-12 flex items-center px-4"><div className="animate-pulse bg-muted rounded h-4 w-40" /></div>
        )}
        {!casesQuery.isLoading && active.length === 0 && (
          <p className="px-4 py-3 text-sm text-muted-foreground">
            {archived.length > 0 ? 'All cases are archived.' : 'No cases yet. Cases appear here once a deadline uses them.'}
          </p>
        )}
        {active.map(row)}
      </div>

      {archived.length > 0 && (
        <div>
          <button
            type="button"
            aria-expanded={showArchived}
            onClick={() => setShowArchived(v => !v)}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            {showArchived ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
            Archived cases ({archived.length})
          </button>
          {showArchived && (
            <div data-testid="archived-cases" className="mt-2 rounded-lg border bg-card overflow-hidden">
              {archived.map(row)}
            </div>
          )}
        </div>
      )}

      <RenameCaseDialog
        from={renaming}
        allLabels={all.map(c => c.caseLabel)}
        countOf={label => all.find(c => c.caseLabel === label)?.totalCount ?? 0}
        onClose={() => setRenaming(null)}
        onDone={() => { setRenaming(null); refresh() }}
      />
    </div>
  )
}

function CaseRow({ summary, color, isCustom, onPickColor, onRename, onArchive }: {
  summary: CaseSummary
  color: string
  isCustom: boolean
  onPickColor: (color: string | null) => void
  onRename: () => void
  onArchive: (archived: boolean) => void
}): React.JSX.Element {
  const [open, setOpen] = useState(false)
  const { caseLabel: label, openCount, archived } = summary
  return (
    <div data-testid="case-row" className="min-h-12 flex items-center gap-3 px-4 py-2 border-b border-border last:border-b-0">
      <span className="flex-1 min-w-0">
        <CaseBadge label={label} color={color} className="text-sm" />
        <span className={cn('ml-2 text-xs', archived && openCount > 0 ? 'text-amber-700 font-semibold' : 'text-muted-foreground')}>
          {openCount === 0 ? 'no open deadlines' : `${openCount} open`}
          {archived && openCount > 0 && ' (archived case still has open deadlines)'}
        </span>
      </span>
      <span className="text-xs text-muted-foreground w-16 text-right">{isCustom ? 'Custom' : 'Automatic'}</span>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" aria-label={`Change color for ${label}`}>Color</Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-3" align="end">
          <div role="group" aria-label={`Colors for ${label}`} className="grid grid-cols-5 gap-2">
            {CASE_PALETTE.map(hex => (
              <button
                key={hex}
                type="button"
                aria-label={`Use color ${hex}`}
                aria-pressed={hex === color}
                onClick={() => { onPickColor(hex); setOpen(false) }}
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
              onClick={() => { onPickColor(null); setOpen(false) }}
            >
              <RotateCcw className="size-4 mr-2" aria-hidden="true" />
              Use automatic color
            </Button>
          )}
        </PopoverContent>
      </Popover>
      <Button variant="ghost" size="sm" aria-label={`Rename ${label}`} onClick={onRename}>
        <Pencil className="size-4" aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        aria-label={archived ? `Unarchive ${label}` : `Archive ${label}`}
        title={archived ? 'Unarchive' : 'Archive (hide from the case picker and filter)'}
        onClick={() => onArchive(!archived)}
      >
        {archived ? <ArchiveRestore className="size-4" aria-hidden="true" /> : <Archive className="size-4" aria-hidden="true" />}
      </Button>
    </div>
  )
}

function RenameCaseDialog({ from, allLabels, countOf, onClose, onDone }: {
  from: string | null
  allLabels: string[]
  countOf: (label: string) => number
  onClose: () => void
  onDone: () => void
}): React.JSX.Element {
  const [to, setTo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const others = useMemo(() => allLabels.filter(l => l !== from), [allLabels, from])
  const target = to.trim() ? findExistingCase(to, others) : null
  const mutation = useMutation({
    mutationFn: ({ fromLabel, toLabel }: { fromLabel: string; toLabel: string }) => renameCase(fromLabel, toLabel),
    onSuccess: () => { setTo(''); setError(null); onDone() },
    onError: (err: Error) => setError(err.message),
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!from || !to.trim()) return
    const toLabel = canonicalizeCaseLabel(to, others)
    if (toLabel === from) { onClose(); return }
    mutation.mutate({ fromLabel: from, toLabel })
  }

  return (
    <Dialog open={from !== null} onOpenChange={open => { if (!open) { setTo(''); setError(null); onClose() } }}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Rename case</DialogTitle>
            <DialogDescription>
              Renames "{from}" on its {deadlineCount(from ? countOf(from) : 0)}. Pick an existing case to merge into it.
            </DialogDescription>
          </DialogHeader>
          <CaseLabelInput id="rename-case-to" value={to} labels={others} onChange={setTo} placeholder="New case name" />
          {target && (
            <p role="status" className="text-sm text-amber-700">
              This merges "{from}" into the existing case "{target}" ({deadlineCount(countOf(target))}).
            </p>
          )}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!to.trim() || mutation.isPending}>{target ? 'Merge' : 'Rename'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function deadlineCount(n: number): string {
  return n === 1 ? '1 deadline' : `${n} deadlines`
}
