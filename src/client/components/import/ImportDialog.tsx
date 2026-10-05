import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

import { createDeadlinesBulk, extractDeadlines, getCaseLabels, getDeadlineTypes } from '@/client/lib/api.js'
import { useCaseColors } from '@/client/hooks/useCaseColors.js'
import { useArchivedCases } from '@/client/hooks/useArchivedCases.js'
import { canonicalizeCaseLabel } from '@/shared/lib/case-labels.js'
import { CaseLabelInput } from '@/client/components/CaseLabelInput.js'
import { Button } from '@/client/components/ui/button.js'
import { Textarea } from '@/client/components/ui/textarea.js'
import { Label } from '@/client/components/ui/label.js'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog.js'
import { ProposalReview, reviewedDeadlines, toReviewRows, type ReviewRow } from './ProposalReview.js'

/**
 * Import deadlines from pasted text (scheduling order, minute order, stipulation, email):
 * paste -> Claude proposes every deadline -> review/edit -> save. Nothing is saved until
 * "Add N deadlines" (NL-03: model output never auto-saves).
 */
export function ImportDialog({ open, onOpenChange }: {
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const queryClient = useQueryClient()
  const typesQuery = useQuery({ queryKey: ['deadline-types'], queryFn: getDeadlineTypes })
  const labelsQuery = useQuery({ queryKey: ['case-labels'], queryFn: getCaseLabels })
  const caseColorOf = useCaseColors()
  const isArchived = useArchivedCases()
  const caseLabels = labelsQuery.data ?? []

  const [text, setText] = useState('')
  const [caseHint, setCaseHint] = useState('')
  const [rows, setRows] = useState<ReviewRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reset = () => { setText(''); setCaseHint(''); setRows(null); setError(null) }
  const close = () => { reset(); onOpenChange(false) }

  const extract = useMutation({
    mutationFn: () => extractDeadlines(text, caseHint.trim() ? canonicalizeCaseLabel(caseHint, caseLabels) : null),
    onSuccess: ({ proposals }) => {
      setError(null)
      if (proposals.length === 0) setError('No dated deadlines were found in that text.')
      else setRows(toReviewRows(proposals))
    },
    onError: (err: Error) => setError(err.message),
  })
  const save = useMutation({
    mutationFn: createDeadlinesBulk,
    onSuccess: () => {
      for (const key of ['deadlines', 'case-labels', 'cases']) queryClient.invalidateQueries({ queryKey: [key] })
      close()
    },
    onError: (err: Error) => setError(err.message),
  })

  const toSave = rows ? reviewedDeadlines(rows) : null
  const includedCount = rows?.filter(r => r.include).length ?? 0

  return (
    <Dialog open={open} onOpenChange={o => (o ? onOpenChange(true) : close())}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import deadlines</DialogTitle>
          <DialogDescription>
            {rows
              ? 'Review each proposed deadline. Edit anything that is off, uncheck what you don\'t want, then add them.'
              : 'Paste a scheduling order, minute order, stipulation or email. The AI finds every deadline in it for you to review; nothing is saved until you confirm. The text is sent to the AI provider chosen in Settings > Setup (OpenAI or Anthropic) to be read.'}
          </DialogDescription>
        </DialogHeader>

        {!rows && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="import-case">Case (optional)</Label>
              <CaseLabelInput
                id="import-case"
                value={caseHint}
                labels={caseLabels}
                caseColorOf={caseColorOf}
                isHidden={isArchived}
                onChange={setCaseHint}
                placeholder="Which case is this for? Leave blank to detect from the text"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="import-text">Text</Label>
              <Textarea
                id="import-text"
                value={text}
                onChange={e => setText(e.target.value)}
                rows={12}
                placeholder="Paste the order or email text here"
                className="font-mono text-xs"
              />
            </div>
          </div>
        )}

        {rows && (
          <ProposalReview
            rows={rows}
            onChange={setRows}
            types={typesQuery.data ?? []}
            caseLabels={caseLabels}
            caseColorOf={caseColorOf}
            isArchived={isArchived}
          />
        )}

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          {rows && (
            <Button type="button" variant="ghost" onClick={() => { setRows(null); setError(null) }} disabled={save.isPending}>
              Back
            </Button>
          )}
          <Button type="button" variant="ghost" onClick={close}>Cancel</Button>
          {!rows ? (
            <Button type="button" onClick={() => extract.mutate()} disabled={!text.trim() || extract.isPending}>
              {extract.isPending ? <><Loader2 className="size-4 mr-2 animate-spin" />Reading… (up to a minute)</> : 'Find deadlines'}
            </Button>
          ) : (
            <Button type="button" onClick={() => toSave && save.mutate(toSave)} disabled={!toSave || includedCount === 0 || save.isPending}>
              {save.isPending ? 'Saving…' : `Add ${includedCount} deadline${includedCount === 1 ? '' : 's'}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
