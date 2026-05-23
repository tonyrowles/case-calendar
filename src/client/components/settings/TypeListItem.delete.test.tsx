// @vitest-environment jsdom
// WR-03: TypeListItem — 2-step inline delete confirmation
import React from 'react'
import { describe, it, expect, vi, afterEach, act } from 'vitest'
import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

afterEach(() => cleanup())

// Mock the mutations hook so we control remove.mutate
const mockMutate = vi.fn()
vi.mock('@/client/hooks/useDeadlineTypeMutations.js', () => ({
  useDeadlineTypeMutations: () => ({
    update: { mutate: vi.fn(), isPending: false },
    remove: { mutate: mockMutate, isPending: false },
  }),
}))

// Import AFTER mock is registered
const { TypeListItem } = await import('./TypeListItem.js')

function renderItem(id = 1, name = 'Filing', color = '#374151') {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={qc}>
      <TypeListItem id={id} name={name} color={color} />
    </QueryClientProvider>
  )
}

describe('WR-03: TypeListItem — 2-step inline delete confirmation', () => {
  it('Delete button has opacity-0 class (hidden until hover)', () => {
    renderItem()
    const deleteBtn = screen.getByRole('button', { name: /delete type/i })
    expect(deleteBtn.className).toContain('opacity-0')
    expect(deleteBtn.className).toContain('group-hover:opacity-100')
  })

  it('first click shows "Are you sure?" confirmation button', () => {
    renderItem()
    const deleteBtn = screen.getByRole('button', { name: /delete type/i })
    fireEvent.click(deleteBtn)
    expect(screen.getByRole('button', { name: /confirm delete type/i })).toBeDefined()
    expect(screen.getByText('Are you sure?')).toBeDefined()
  })

  it('second click fires mutations.remove.mutate with the type id', () => {
    mockMutate.mockClear()
    renderItem(7, 'Filing', '#374151')
    // Step 1: click Delete
    const deleteBtn = screen.getByRole('button', { name: /delete type/i })
    fireEvent.click(deleteBtn)
    // Step 2: click "Are you sure?"
    const confirmBtn = screen.getByRole('button', { name: /confirm delete type/i })
    fireEvent.click(confirmBtn)
    expect(mockMutate).toHaveBeenCalledTimes(1)
    expect(mockMutate.mock.calls[0][0]).toBe(7)
  })

  it('first click does NOT fire mutations.remove.mutate immediately', () => {
    mockMutate.mockClear()
    renderItem()
    const deleteBtn = screen.getByRole('button', { name: /delete type/i })
    fireEvent.click(deleteBtn)
    expect(mockMutate).not.toHaveBeenCalled()
  })

  it('Escape key resets confirm state to idle', async () => {
    renderItem()
    const deleteBtn = screen.getByRole('button', { name: /delete type/i })
    fireEvent.click(deleteBtn)
    expect(screen.getByText('Are you sure?')).toBeDefined()

    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.queryByText('Are you sure?')).toBeNull()
      expect(screen.getByRole('button', { name: /delete type/i })).toBeDefined()
    })
  })

  it('5-second timeout resets confirm state to idle', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    renderItem()
    try {
      const deleteBtn = screen.getByRole('button', { name: /delete type/i })
      fireEvent.click(deleteBtn)
      expect(screen.getByText('Are you sure?')).toBeDefined()

      act(() => { vi.advanceTimersByTime(5001) })

      expect(screen.queryByText('Are you sure?')).toBeNull()
      expect(screen.getByRole('button', { name: /delete type/i })).toBeDefined()
    } finally {
      vi.useRealTimers()
    }
  })

  it('blur on "Are you sure?" button resets to idle', () => {
    renderItem()
    const deleteBtn = screen.getByRole('button', { name: /delete type/i })
    fireEvent.click(deleteBtn)
    const confirmBtn = screen.getByRole('button', { name: /confirm delete type/i })
    act(() => { fireEvent.blur(confirmBtn) })
    expect(screen.queryByText('Are you sure?')).toBeNull()
  })
})
