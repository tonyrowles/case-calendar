// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CASE_PALETTE } from '@/shared/lib/case-colors.js'
import type { CaseSummary } from '@/shared/schemas/cases.js'
import { CaseList } from './CaseList.js'

vi.mock('@/client/lib/api.js', () => ({
  extractDeadlines: vi.fn().mockResolvedValue({ proposals: [] }),
  createDeadlinesBulk: vi.fn().mockResolvedValue({ created: 0 }),
  getCases: vi.fn().mockResolvedValue([]),
  getCaseColors: vi.fn().mockResolvedValue([]),
  getDeadlines: vi.fn().mockResolvedValue([]),
  setCaseColor: vi.fn().mockResolvedValue({}),
  resetCaseColor: vi.fn().mockResolvedValue(undefined),
  renameCase: vi.fn().mockResolvedValue({ changed: 2 }),
  setCaseArchived: vi.fn().mockResolvedValue(undefined),
}))
import { getCaseColors, getCases, renameCase, resetCaseColor, setCaseArchived, setCaseColor } from '@/client/lib/api.js'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const CASES: CaseSummary[] = [
  { caseLabel: 'Glaukos/Spyglass', openCount: 2, totalCount: 3, archived: false },
  { caseLabel: 'Smith v. Jones', openCount: 1, totalCount: 2, archived: false },
  { caseLabel: 'smith v jones', openCount: 1, totalCount: 1, archived: false },
  { caseLabel: 'Old Matter', openCount: 1, totalCount: 4, archived: true },
]
const PINNED = CASE_PALETTE[3]

// Saves invalidate and refetch these queries: answer with the same data the test starts with
beforeEach(() => {
  vi.mocked(getCases).mockResolvedValue(CASES)
  vi.mocked(getCaseColors).mockResolvedValue([{ caseLabel: 'glaukos/spyglass', color: PINNED }])
})

function renderList() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  qc.setQueryData(['cases'], CASES)
  qc.setQueryData(['case-colors'], [{ caseLabel: 'glaukos/spyglass', color: PINNED }])
  qc.setQueryData(['deadlines'], [])
  return render(<QueryClientProvider client={qc}><CaseList /></QueryClientProvider>)
}
const rowFor = (label: string) =>
  screen.getAllByTestId('case-row').find(r => within(r).queryByTestId('case-badge')?.textContent === label)!

describe('CaseList (Settings > Cases)', () => {
  it('lists active cases with open counts and Automatic/Custom; archived cases are collapsed', () => {
    renderList()
    expect(within(rowFor('Glaukos/Spyglass')).getByText('Custom')).toBeTruthy()
    expect(rowFor('Glaukos/Spyglass').textContent).toContain('2 open')
    expect(within(rowFor('Smith v. Jones')).getByText('Automatic')).toBeTruthy()
    expect(screen.queryByTestId('archived-cases')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /archived cases \(1\)/i }))
    const archived = screen.getByTestId('archived-cases')
    expect(archived.textContent).toContain('Old Matter')
    expect(archived.textContent).toContain('archived case still has open deadlines')
  })

  it('picking a color saves it; "Use automatic color" resets a custom one', async () => {
    renderList()
    fireEvent.click(screen.getByRole('button', { name: 'Change color for Smith v. Jones' }))
    const palette = await screen.findByRole('group', { name: 'Colors for Smith v. Jones' })
    fireEvent.click(within(palette).getByRole('button', { name: `Use color ${CASE_PALETTE[7]}` }))
    await waitFor(() => expect(setCaseColor).toHaveBeenCalledWith('Smith v. Jones', CASE_PALETTE[7]))

    fireEvent.click(screen.getByRole('button', { name: 'Change color for Glaukos/Spyglass' }))
    fireEvent.click(await screen.findByText('Use automatic color'))
    await waitFor(() => expect(resetCaseColor).toHaveBeenCalledWith('Glaukos/Spyglass'))
  })

  it('rename to a new name renames', async () => {
    renderList()
    fireEvent.click(screen.getByRole('button', { name: 'Rename Glaukos/Spyglass' }))
    const input = await screen.findByPlaceholderText('New case name')
    fireEvent.change(input, { target: { value: 'Glaukos v. Spyglass' } })
    expect(screen.queryByText(/merges/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }))
    await waitFor(() => expect(renameCase).toHaveBeenCalledWith('Glaukos/Spyglass', 'Glaukos v. Spyglass'))
  })

  it('renaming onto an existing case warns it will merge, and merges into the exact existing name', async () => {
    renderList()
    fireEvent.click(screen.getByRole('button', { name: 'Rename smith v jones' }))
    const input = await screen.findByPlaceholderText('New case name')
    fireEvent.change(input, { target: { value: 'SMITH V. JONES' } })
    expect(screen.getByRole('status').textContent).toContain('merges "smith v jones" into the existing case "Smith v. Jones"')
    fireEvent.click(screen.getByRole('button', { name: 'Merge' }))
    await waitFor(() => expect(renameCase).toHaveBeenCalledWith('smith v jones', 'Smith v. Jones'))
  })

  it('archive and unarchive', async () => {
    renderList()
    fireEvent.click(screen.getByRole('button', { name: 'Archive Smith v. Jones' }))
    await waitFor(() => expect(setCaseArchived).toHaveBeenCalledWith('Smith v. Jones', true))
    fireEvent.click(screen.getByRole('button', { name: /archived cases/i }))
    fireEvent.click(screen.getByRole('button', { name: 'Unarchive Old Matter' }))
    await waitFor(() => expect(setCaseArchived).toHaveBeenCalledWith('Old Matter', false))
  })
})
