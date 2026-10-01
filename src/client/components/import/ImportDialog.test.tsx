// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { DeadlineProposal } from '@/shared/schemas/imports.js'
import { ImportDialog } from './ImportDialog.js'

const PROPOSALS: DeadlineProposal[] = [
  { date: '2026-11-02', caseLabel: 'Smith v. Jones', typeId: 1, title: 'Opposition Due', notes: '', dateBasis: 'stated', basis: '', sourceText: 'Opposition due Nov 2.' },
  { date: '2026-11-20', caseLabel: '', typeId: 2, title: 'Hearing on MSJ', notes: 'Dept. 14, 8:30 AM', dateBasis: 'computed', basis: '10 days before trial', sourceText: 'Hearing ...' },
  { date: '2026-12-01', caseLabel: 'Smith v. Jones', typeId: 1, title: 'Reply Due', notes: '', dateBasis: 'stated', basis: '', sourceText: 'Reply ...' },
]

vi.mock('@/client/lib/api.js', () => ({
  getEmailInbox: vi.fn().mockResolvedValue({ enabled: false, address: null, items: [], lastCheck: null }),
  checkEmailInbox: vi.fn().mockResolvedValue({ enabled: false, address: null, items: [], lastCheck: null }),
  acceptEmailImport: vi.fn().mockResolvedValue({ created: 0 }),
  dismissEmailImport: vi.fn().mockResolvedValue(undefined),
  getDeadlineTypes: vi.fn().mockResolvedValue([]),
  getCaseLabels: vi.fn().mockResolvedValue([]),
  getCaseColors: vi.fn().mockResolvedValue([]),
  getCases: vi.fn().mockResolvedValue([]),
  getDeadlines: vi.fn().mockResolvedValue([]),
  extractDeadlines: vi.fn(),
  createDeadlinesBulk: vi.fn().mockResolvedValue({ created: 2 }),
}))
import { createDeadlinesBulk, extractDeadlines } from '@/client/lib/api.js'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderDialog() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  qc.setQueryData(['deadline-types'], [
    { id: 1, name: 'Filing', color: '#374151', createdAt: '' },
    { id: 2, name: 'Hearing', color: '#374151', createdAt: '' },
  ])
  qc.setQueryData(['case-labels'], ['Smith v. Jones'])
  qc.setQueryData(['cases'], [])
  qc.setQueryData(['case-colors'], [])
  qc.setQueryData(['deadlines'], [])
  const onOpenChange = vi.fn()
  render(<QueryClientProvider client={qc}><ImportDialog open onOpenChange={onOpenChange} /></QueryClientProvider>)
  return { onOpenChange }
}

describe('ImportDialog', () => {
  it('paste -> review -> fix/uncheck -> saves only the reviewed rows', async () => {
    vi.mocked(extractDeadlines).mockResolvedValue({ proposals: PROPOSALS })
    const { onOpenChange } = renderDialog()
    fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'SCHEDULING ORDER ...' } })
    fireEvent.click(screen.getByRole('button', { name: 'Find deadlines' }))
    await waitFor(() => expect(screen.getAllByTestId('proposal-row')).toHaveLength(3))
    expect(extractDeadlines).toHaveBeenCalledWith('SCHEDULING ORDER ...', null)

    // Computed date is flagged
    expect(screen.getByRole('status').textContent).toContain('1 date was computed')
    // Row 2 has no case -> Add is blocked until fixed
    const add = () => screen.getByRole('button', { name: /^Add \d+ deadlines?$/ })
    expect((add() as HTMLButtonElement).disabled).toBe(true)
    const rows = screen.getAllByTestId('proposal-row')
    fireEvent.change(within(rows[1]).getByPlaceholderText('Case'), { target: { value: 'Smith v. Jones' } })
    // Leave out row 3
    fireEvent.click(within(rows[2]).getByRole('checkbox'))
    expect(add().textContent).toBe('Add 2 deadlines')
    expect((add() as HTMLButtonElement).disabled).toBe(false)

    fireEvent.click(add())
    await waitFor(() => expect(createDeadlinesBulk).toHaveBeenCalled())
    expect(vi.mocked(createDeadlinesBulk).mock.calls[0][0]).toEqual([
      { date: '2026-11-02', caseLabel: 'Smith v. Jones', typeId: 1, description: 'Opposition Due' },
      { date: '2026-11-20', caseLabel: 'Smith v. Jones', typeId: 2, description: 'Hearing on MSJ\nDept. 14, 8:30 AM' },
    ])
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false))
  })

  it('passes the chosen case, and shows an error when nothing is found', async () => {
    vi.mocked(extractDeadlines).mockResolvedValue({ proposals: [] })
    renderDialog()
    fireEvent.change(screen.getByLabelText('Text'), { target: { value: 'hello' } })
    const caseInput = screen.getByPlaceholderText(/which case/i)
    fireEvent.change(caseInput, { target: { value: 'smith v jones' } })
    fireEvent.click(screen.getByRole('button', { name: 'Find deadlines' }))
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('No dated deadlines'))
    expect(extractDeadlines).toHaveBeenCalledWith('hello', 'Smith v. Jones')
    expect(createDeadlinesBulk).not.toHaveBeenCalled()
  })
})
