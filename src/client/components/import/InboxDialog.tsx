import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ChevronDown, ChevronRight, Loader2, Mail, RefreshCw } from 'lucide-react'

import {
  acceptEmailImport,
  checkEmailInbox,
  dismissEmailImport,
  getCaseLabels,
  getDeadlineTypes,
  getEmailInbox,
} from '@/client/lib/api.js'
import { useCaseColors } from '@/client/hooks/useCaseColors.js'
import { useArchivedCases } from '@/client/hooks/useArchivedCases.js'
import type { EmailImport } from '@/shared/schemas/email-imports.js'
import { Button } from '@/client/components/ui/button.js'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/client/components/ui/dialog.js'
import { ProposalReview, reviewedDeadlines, toReviewRows, type ReviewRow } from './ProposalReview.js'

/** Shared query: header badge, wallpaper reminder and this dialog read the same data. */
export function useEmailInbox() {
  return useQuery({ queryKey: ['email-imports'], queryFn: getEmailInbox, retry: false, refetchInterval: 60_000 })
}

function when(iso: string): string {
  // Timestamps are full ISO date-times (not bare dates), so Date parsing is safe here
  const d = new Date(Date.parse(iso))
  return Number.isNaN(d.getTime()) ? iso : format(d, 'MMM d, h:mm a')
}

/**
 * Inbox: orders emailed to the import address, extracted into proposals. Open one to
 * review and add its deadlines, or dismiss it. Emails that weren't imported (sender not
 * allowed, nothing found, errors) are listed with the reason.
 */
export function InboxDialog({ open, onOpenChange }: {
  open: boolean
  onOpenChange: (open: boolean) => void
}): React.JSX.Element {
  const queryClient = useQueryClient()
  const inboxQuery = useEmailInbox()
  const typesQuery = useQuery({ queryKey: ['deadline-types'], queryFn: getDeadlineTypes })
  const labelsQuery = useQuery({ queryKey: ['case-labels'], queryFn: getCaseLabels })
  const caseColorOf = useCaseColors()
  const isArchived = useArchivedCases()

  const [selected, setSelected] = useState<EmailImport | null>(null)
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [error, setError] = useState<string | null>(null)
  const [showProblems, setShowProblems] = useState(false)

  const refresh = () => {
    for (const key of ['email-imports', 'deadlines', 'case-labels', 'cases']) queryClient.invalidateQueries({ queryKey: [key] })
  }
  const openItem = (item: EmailImport) => { setSelected(item); setRows(toReviewRows(item.proposals)); setError(null) }
  const back = () => { setSelected(null); setRows([]); setError(null) }

  const check = useMutation({
    mutationFn: checkEmailInbox,
    onSuccess: data => queryClient.setQueryData(['email-imports'], data),
    onError: (err: Error) => setError(err.message),
  })
  const accept = useMutation({
    mutationFn: ({ id, deadlines }: { id: number; deadlines: NonNullable<ReturnType<typeof reviewedDeadlines>> }) => acceptEmailImport(id, deadlines),
    onSuccess: () => { refresh(); back() },
    onError: (err: Error) => setError(err.message),
  })
  const dismiss = useMutation({
    mutationFn: dismissEmailImport,
    onSuccess: () => { refresh(); back() },
    onError: (err: Error) => setError(err.message),
  })

  const inbox = inboxQuery.data
  const pending = inbox?.items.filter(i => i.status === 'pending') ?? []
  const problems = inbox?.items.filter(i => i.status !== 'pending') ?? []
  const toSave = selected ? reviewedDeadlines(rows) : null
  const includedCount = rows.filter(r => r.include).length

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) back(); onOpenChange(o) }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{selected ? selected.subject : 'Inbox'}</DialogTitle>
          <DialogDescription>
            {selected
              ? `From ${selected.fromAddress}, ${when(selected.receivedAt)}. Review the deadlines found in this email, then add them.`
              : inbox?.enabled
                ? <>Email an order or scheduling notice to <strong>{inbox.address}</strong>. Deadlines found in it wait here for your review; nothing is added until you confirm.</>
                : 'Email import is off. Set EMAIL_IMPORT_ENABLED=true and EMAIL_IMPORT_ADDRESS in .env.local (see docs/DEPLOYMENT.md), then restart the server.'}
          </DialogDescription>
        </DialogHeader>

        {!selected && (
          <div className="space-y-3">
            {inbox?.lastCheck && (
              <p className={inbox.lastCheck.ok && !inbox.lastCheck.error ? 'text-xs text-muted-foreground' : 'text-xs text-amber-800'}>
                Last checked {when(inbox.lastCheck.at)}{inbox.lastCheck.error ? `: ${inbox.lastCheck.error}` : '.'}
              </p>
            )}
            {pending.length === 0 && inbox?.enabled && (
              <p className="text-sm text-muted-foreground">Nothing waiting for review.</p>
            )}
            {pending.length > 0 && (
              <ul className="divide-y divide-border rounded-md border" aria-label="Emails to review">
                {pending.map(item => (
                  <li key={item.id}>
                    <button type="button" onClick={() => openItem(item)} className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-center gap-3">
                      <Mail className="size-4 text-muted-foreground shrink-0" aria-hidden="true" />
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-semibold truncate">{item.subject}</span>
                        <span className="block text-xs text-muted-foreground">{item.fromAddress}, {when(item.receivedAt)}</span>
                      </span>
                      <span className="text-xs rounded bg-amber-100 px-1.5 py-0.5 text-amber-900 shrink-0">
                        {item.proposals.length} deadline{item.proposals.length === 1 ? '' : 's'} to review
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {problems.length > 0 && (
              <div>
                <button type="button" aria-expanded={showProblems} onClick={() => setShowProblems(v => !v)}
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                  {showProblems ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
                  Not imported ({problems.length})
                </button>
                {showProblems && (
                  <ul className="mt-2 divide-y divide-border rounded-md border" aria-label="Emails not imported">
                    {problems.map(item => (
                      <li key={item.id} className="px-3 py-2 flex items-start gap-3">
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm truncate">{item.subject}</span>
                          <span className="block text-xs text-muted-foreground">{item.fromAddress}, {when(item.receivedAt)}</span>
                          <span className="block text-xs text-amber-800">{item.reason}</span>
                        </span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => dismiss.mutate(item.id)}>Dismiss</Button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {selected && (
          <ProposalReview
            rows={rows}
            onChange={setRows}
            types={typesQuery.data ?? []}
            caseLabels={labelsQuery.data ?? []}
            caseColorOf={caseColorOf}
            isArchived={isArchived}
          />
        )}

        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <DialogFooter>
          {!selected ? (
            <>
              {inbox?.enabled && (
                <Button type="button" variant="ghost" onClick={() => check.mutate()} disabled={check.isPending}>
                  {check.isPending ? <Loader2 className="size-4 mr-2 animate-spin" /> : <RefreshCw className="size-4 mr-2" />}
                  Check now
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Close</Button>
            </>
          ) : (
            <>
              <Button type="button" variant="ghost" onClick={back} disabled={accept.isPending}>Back</Button>
              <Button type="button" variant="ghost" onClick={() => dismiss.mutate(selected.id)} disabled={accept.isPending || dismiss.isPending}>
                Dismiss email
              </Button>
              <Button
                type="button"
                onClick={() => toSave && accept.mutate({ id: selected.id, deadlines: toSave })}
                disabled={!toSave || includedCount === 0 || accept.isPending}
              >
                {accept.isPending ? 'Saving…' : `Add ${includedCount} deadline${includedCount === 1 ? '' : 's'}`}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
