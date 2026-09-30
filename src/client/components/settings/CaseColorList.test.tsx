// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { CASE_PALETTE } from '@/shared/lib/case-colors.js'
import { CaseColorList } from './CaseColorList.js'

vi.mock('@/client/lib/api.js', () => ({
  getCaseLabels: vi.fn().mockResolvedValue([]),
  getCaseColors: vi.fn().mockResolvedValue([]),
  getDeadlines: vi.fn().mockResolvedValue([]),
  setCaseColor: vi.fn().mockResolvedValue({}),
  resetCaseColor: vi.fn().mockResolvedValue(undefined),
}))
import { resetCaseColor, setCaseColor } from '@/client/lib/api.js'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const PINNED = CASE_PALETTE[3]

function renderList() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } })
  qc.setQueryData(['case-labels'], ['Glaukos/Spyglass', 'Smith v. Jones'])
  qc.setQueryData(['case-colors'], [{ caseLabel: 'glaukos/spyglass', color: PINNED }])
  qc.setQueryData(['deadlines'], [])
  return render(
    <QueryClientProvider client={qc}>
      <CaseColorList />
    </QueryClientProvider>
  )
}

function rowFor(label: string): HTMLElement {
  return screen.getAllByTestId('case-color-row').find(r => r.textContent?.includes(label))!
}

describe('CaseColorList (Settings > Cases)', () => {
  it('lists every case with its current color; chosen colors are marked Custom', () => {
    renderList()
    const glaukos = rowFor('Glaukos/Spyglass')
    expect(within(glaukos).getByText('Custom')).toBeTruthy()
    const badge = within(glaukos).getByTestId('case-badge')
    // Override matched case-insensitively; jsdom reports inline colors as rgb()
    const hex = PINNED.slice(1)
    const rgb = `rgb(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)})`
    expect(badge.style.backgroundColor).toBe(rgb)
    expect(within(rowFor('Smith v. Jones')).getByText('Automatic')).toBeTruthy()
  })

  it('picking a palette color saves it for that case', async () => {
    renderList()
    fireEvent.click(screen.getByRole('button', { name: 'Change color for Smith v. Jones' }))
    const palette = await screen.findByRole('group', { name: 'Colors for Smith v. Jones' })
    expect(within(palette).getAllByRole('button')).toHaveLength(CASE_PALETTE.length)
    fireEvent.click(within(palette).getByRole('button', { name: `Use color ${CASE_PALETTE[7]}` }))
    await waitFor(() => expect(setCaseColor).toHaveBeenCalledWith('Smith v. Jones', CASE_PALETTE[7]))
  })

  it('"Use automatic color" is offered only for custom colors and resets the case', async () => {
    renderList()
    fireEvent.click(screen.getByRole('button', { name: 'Change color for Smith v. Jones' }))
    await screen.findByRole('group', { name: 'Colors for Smith v. Jones' })
    expect(screen.queryByText('Use automatic color')).toBeNull()
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' })

    fireEvent.click(screen.getByRole('button', { name: 'Change color for Glaukos/Spyglass' }))
    fireEvent.click(await screen.findByText('Use automatic color'))
    await waitFor(() => expect(resetCaseColor).toHaveBeenCalled())
    expect(vi.mocked(resetCaseColor).mock.calls[0][0]).toBe('Glaukos/Spyglass')
  })
})
