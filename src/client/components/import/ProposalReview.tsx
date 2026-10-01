import React, { useState } from 'react'
import { AlertTriangle } from 'lucide-react'

import { parseLocalDate } from '@/shared/lib/date.js'
import { proposalDescription, type DeadlineProposal } from '@/shared/schemas/imports.js'
import type { DeadlineCreate } from '@/shared/schemas/deadline.js'
import type { DeadlineType } from '@/shared/schemas/deadline.js'
import { CaseLabelInput } from '@/client/components/CaseLabelInput.js'
import { Input } from '@/client/components/ui/input.js'
import { cn } from '@/client/lib/utils.js'

export interface ReviewRow extends DeadlineProposal {
  include: boolean
}

export function toReviewRows(proposals: DeadlineProposal[]): ReviewRow[] {
  return proposals.map(p => ({ ...p, include: true }))
}

function rowProblem(r: ReviewRow): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.date) || parseLocalDate(r.date) === null) return 'Pick a valid date'
  if (!r.caseLabel.trim()) return 'Pick a case'
  if (!r.title.trim()) return 'Add a title'
  return null
}

/** The rows to save, or null while any included row still has a problem. */
export function reviewedDeadlines(rows: ReviewRow[]): DeadlineCreate[] | null {
  const included = rows.filter(r => r.include)
  if (included.some(r => rowProblem(r) !== null)) return null
  return included.map(r => ({
    date: r.date,
    caseLabel: r.caseLabel.trim(),
    typeId: r.typeId,
    description: proposalDescription(r),
  }))
}

/**
 * Review table for proposed deadlines (from the Import dialog or an emailed order).
 * Every field is editable; rows can be left out; computed dates are flagged for checking.
 * The parent owns `rows` and the save button.
 */
export function ProposalReview({ rows, onChange, types, caseLabels, caseColorOf, isArchived }: {
  rows: ReviewRow[]
  onChange: (rows: ReviewRow[]) => void
  types: DeadlineType[]
  caseLabels: readonly string[]
  caseColorOf?: (label: string) => string
  isArchived?: (label: string) => boolean
}): React.JSX.Element {
  const update = (i: number, patch: Partial<ReviewRow>) => onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  const computedCount = rows.filter(r => r.include && r.dateBasis === 'computed').length

  return (
    <div className="space-y-3">
      {computedCount > 0 && (
        <p role="status" className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <AlertTriangle className="size-4 mt-0.5 shrink-0" aria-hidden="true" />
          {computedCount === 1 ? '1 date was' : `${computedCount} dates were`} computed rather than stated in the text.
          Check {computedCount === 1 ? 'it' : 'them'} against the order before saving.
        </p>
      )}
      <ul className="divide-y divide-border rounded-md border" aria-label="Proposed deadlines">
        {rows.map((r, i) => (
          <ProposalRow
            key={i}
            row={r}
            problem={r.include ? rowProblem(r) : null}
            onChange={patch => update(i, patch)}
            types={types}
            caseLabels={caseLabels}
            caseColorOf={caseColorOf}
            isArchived={isArchived}
            index={i}
          />
        ))}
      </ul>
    </div>
  )
}

function ProposalRow({ row, problem, onChange, types, caseLabels, caseColorOf, isArchived, index }: {
  row: ReviewRow
  problem: string | null
  onChange: (patch: Partial<ReviewRow>) => void
  types: DeadlineType[]
  caseLabels: readonly string[]
  caseColorOf?: (label: string) => string
  isArchived?: (label: string) => boolean
  index: number
}): React.JSX.Element {
  const [showSource, setShowSource] = useState(false)
  const id = (f: string) => `proposal-${index}-${f}`
  return (
    <li data-testid="proposal-row" className={cn('p-3 space-y-2', !row.include && 'opacity-50')}>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={row.include}
          onChange={e => onChange({ include: e.target.checked })}
          aria-label={`Include ${row.title || 'deadline'}`}
          className="size-4"
        />
        <Input
          id={id('title')}
          aria-label="Title"
          value={row.title}
          onChange={e => onChange({ title: e.target.value })}
          className="h-8 font-semibold flex-1"
          disabled={!row.include}
        />
        {row.dateBasis === 'computed' && (
          <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-semibold text-amber-900" title={row.basis}>
            computed: verify
          </span>
        )}
      </div>
      <div className="grid grid-cols-[150px_minmax(0,1fr)_170px] gap-2 pl-6">
        <Input
          id={id('date')}
          aria-label="Date"
          type="date"
          value={row.date}
          onChange={e => onChange({ date: e.target.value, dateBasis: 'stated', basis: '' })}
          className="h-8"
          disabled={!row.include}
        />
        <CaseLabelInput
          id={id('case')}
          value={row.caseLabel}
          labels={caseLabels}
          caseColorOf={caseColorOf}
          isHidden={isArchived}
          onChange={v => onChange({ caseLabel: v })}
          placeholder="Case"
        />
        <select
          aria-label="Type"
          value={row.typeId}
          onChange={e => onChange({ typeId: Number(e.target.value) })}
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          disabled={!row.include}
        >
          {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>
      <div className="pl-6 space-y-1">
        <Input
          aria-label="Details"
          placeholder="Details (time, department, notes)"
          value={row.notes}
          onChange={e => onChange({ notes: e.target.value })}
          className="h-8 text-sm"
          disabled={!row.include}
        />
        {row.dateBasis === 'computed' && row.basis && (
          <p className="text-xs text-amber-900">How the date was computed: {row.basis}</p>
        )}
        {row.sourceText && (
          <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" onClick={() => setShowSource(v => !v)}>
            {showSource ? 'Hide source' : 'Show source text'}
          </button>
        )}
        {showSource && <blockquote className="border-l-2 pl-2 text-xs text-muted-foreground italic">{row.sourceText}</blockquote>}
        {problem && <p role="alert" className="text-xs text-destructive">{problem}</p>}
      </div>
    </li>
  )
}
