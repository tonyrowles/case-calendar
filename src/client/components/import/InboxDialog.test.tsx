// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { EmailInbox } from '@/shared/schemas/email-imports.js'
import { InboxDialog } from './InboxDialog.js'

vi.mock('@/client/lib/api.js', () => ({
  getEmailInbox: vi.fn(),
  checkEmailInbox: vi.fn(),
  acceptEmailImport: vi.fn().mockResolvedValue({ created: 1 }),
  dismissEmailImport: vi.fn().mockResolvedValue(undefined),
  getDeadlineTypes: vi.fn().mockResolvedValue([]),
  getCaseLabels: vi.fn().mockResolvedValue([]),
  getCaseColors: vi.fn().mockResolvedValue([]),
  getCases: vi.fn().mockResolvedValue([]),
  getDeadlines: vi.fn().mockResolvedValue([]),
}))
import { acceptEmailImport, dismissEmailImport, getEmailInbox } from '@/client/lib/api.js'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const INBOX: EmailInbox = {
  enabled: true,
  address: 'jdoe+calendar@gmail.com',
  lastCheck: { at: '2026-09-30T17:00:00.000Z', ok: true, error: null },
  items: [
    {
      id: 7, fromAddress: 'jdoe@gmail.com', subject: 'Fwd: Minute order', receivedAt: '2026-09-30T16:00:00.000Z',
      status: 'pending', reason: null,
      proposals: [{ date: '2026-11-20', caseLabel: 'Smith v. Jones', typeId: 2, title: 'Hearing on MSJ', notes: 'Dept. 14', dateBasis: 'stated', basis: '', sourceText: '...' }],
    },
    {
      id: 8, fromAddress: 'stranger@example.com', subject: 'Hi', receivedAt: '2026-09-29T16:00:00.000Z',
      status: 'rejected', reason: 'Sender stranger@example.com is not on the allowed list.', proposals: [],
    },
  ],
}

function renderInbox(inbox: EmailInbox) {
  vi.mocked(getEmailInbox).mockResolvedValue(inbox)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  qc.setQueryData(['email-imports'], inbox)
  qc.setQueryData(['deadline-types'], [{ id: 2, name: 'Hearing', color: '#374151', createdAt: '' }])
  qc.setQueryData(['case-labels'], ['Smith v. Jones'])
  qc.setQueryData(['cases'], [])
  qc.setQueryData(['case-colors'], [])
  qc.setQueryData(['deadlines'], [])
  render(<QueryClientProvider client={qc}><InboxDialog open onOpenChange={() => {}} /></QueryClientProvider>)
}

describe('InboxDialog', () => {
  it('shows the import address, pending emails, and emails not imported with the reason', () => {
    renderInbox(INBOX)
    expect(screen.getByText('jdoe+calendar@gmail.com')).toBeTruthy()
    expect(screen.getByRole('list', { name: 'Emails to review' }).textContent).toContain('1 deadline to review')
    fireEvent.click(screen.getByRole('button', { name: /not imported \(1\)/i }))
    expect(screen.getByRole('list', { name: 'Emails not imported' }).textContent).toContain('not on the allowed list')
  })

  it('opening an email shows its deadlines for review; Add saves them via accept', async () => {
    renderInbox(INBOX)
    fireEvent.click(screen.getByText('Fwd: Minute order'))
    expect(screen.getAllByTestId('proposal-row')).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: 'Add 1 deadline' }))
    await waitFor(() => expect(acceptEmailImport).toHaveBeenCalledWith(7, [
      { date: '2026-11-20', caseLabel: 'Smith v. Jones', typeId: 2, description: 'Hearing on MSJ\nDept. 14' },
    ]))
  })

  it('Dismiss email dismisses it', async () => {
    renderInbox(INBOX)
    fireEvent.click(screen.getByText('Fwd: Minute order'))
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss email' }))
    await waitFor(() => expect(dismissEmailImport).toHaveBeenCalled())
    expect(vi.mocked(dismissEmailImport).mock.calls[0][0]).toBe(7)
  })

  it('explains how to turn email import on when it is off', () => {
    renderInbox({ enabled: false, address: null, items: [], lastCheck: null })
    expect(screen.getByText(/Email import is off/)).toBeTruthy()
  })
})
