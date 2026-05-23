// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import { waitFor } from '@testing-library/dom'
import type { Deadline, DeadlineType } from '@/shared/schemas/deadline.js'
import { DeadlineRow } from './DeadlineRow.js'

// CRUD-04: DeadlineRow 2-step inline delete confirmation

afterEach(() => cleanup())

const TYPE_FILING: DeadlineType = { id: 1, name: 'Filing', color: '#374151', createdAt: '' }
const typesById = new Map([[1, TYPE_FILING]])
const getColor = (_id: number) => '#374151'

function makeDeadline(overrides: Partial<Deadline> = {}): Deadline {
  return {
    id: 5,
    date: '2026-06-15',
    caseLabel: 'Smith v. Jones',
    typeId: 1,
    description: null,
    completedAt: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  }
}

function renderRow(
  onDelete?: (id: number, onError: () => void) => void,
  onRowClick?: (id: number) => void
) {
  return render(
    <DeadlineRow
      deadline={makeDeadline()}
      bucket="thisWeek"
      typesById={typesById}
      getColor={getColor}
      onDelete={onDelete}
      onRowClick={onRowClick}
    />
  )
}

describe('CRUD-04: DeadlineRow — 2-step inline delete confirmation', () => {
  it('Delete button has opacity-0 class (hidden until hover)', () => {
    renderRow()
    const deleteBtn = screen.getByRole('button', { name: /delete deadline/i })
    // The button has opacity-0 (visible only via group-hover via CSS)
    expect(deleteBtn.className).toContain('opacity-0')
    expect(deleteBtn.className).toContain('group-hover:opacity-100')
  })

  it('first click changes button label to "Are you sure?"', () => {
    renderRow()
    const deleteBtn = screen.getByRole('button', { name: /delete deadline/i })
    fireEvent.click(deleteBtn)
    expect(screen.getByText('Are you sure?')).toBeDefined()
  })

  it('second click changes label to "Confirm Delete" and fires onDelete callback with id + reset fn', () => {
    const onDelete = vi.fn()
    renderRow(onDelete)
    // Step 1: click Delete
    const deleteBtn = screen.getByRole('button', { name: /delete deadline/i })
    fireEvent.click(deleteBtn)
    // Step 2: click "Are you sure?"
    const confirmBtn = screen.getByRole('button', { name: /confirm delete/i })
    fireEvent.click(confirmBtn)
    expect(screen.getByText('Confirm Delete')).toBeDefined()
    expect(onDelete).toHaveBeenCalledTimes(1)
    // First arg is deadline id; second arg is the reset callback (WR-01)
    expect(onDelete.mock.calls[0][0]).toBe(5)
    expect(typeof onDelete.mock.calls[0][1]).toBe('function')
  })

  it('WR-01: calling the onError reset fn returns the row to idle from executing state', async () => {
    // Simulate a failed DELETE: onDelete receives the reset fn and calls it synchronously
    let capturedReset: (() => void) | undefined
    const onDelete = vi.fn((_, reset: () => void) => {
      capturedReset = reset
    })
    renderRow(onDelete)
    // Step 1: click Delete → confirm state
    const deleteBtn = screen.getByRole('button', { name: /delete deadline/i })
    fireEvent.click(deleteBtn)
    // Step 2: click "Are you sure?" → executing state
    const confirmBtn = screen.getByRole('button', { name: /confirm delete/i })
    fireEvent.click(confirmBtn)
    expect(screen.getByText('Confirm Delete')).toBeDefined()

    // Simulate mutation error by invoking the captured reset callback
    expect(capturedReset).toBeDefined()
    act(() => {
      capturedReset!()
    })

    // Row must return to idle: "Delete" button is visible again
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete deadline/i })).toBeDefined()
      expect(screen.queryByText('Confirm Delete')).toBeNull()
    })
  })

  it('clicking the Delete button does NOT trigger onRowClick (stopPropagation)', () => {
    const onRowClick = vi.fn()
    const onDelete = vi.fn()
    renderRow(onDelete, onRowClick)
    const deleteBtn = screen.getByRole('button', { name: /delete deadline/i })
    fireEvent.click(deleteBtn)
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('Escape key resets confirm state to idle', async () => {
    renderRow()
    // Enter confirm state
    const deleteBtn = screen.getByRole('button', { name: /delete deadline/i })
    fireEvent.click(deleteBtn)
    expect(screen.getByText('Are you sure?')).toBeDefined()

    // Press Escape
    fireEvent.keyDown(document, { key: 'Escape' })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /delete deadline/i })).toBeDefined()
      expect(screen.queryByText('Are you sure?')).toBeNull()
    })
  })

  it('8-second timeout resets confirm state to idle', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false })
    renderRow()
    try {
      // Enter confirm state
      const deleteBtn = screen.getByRole('button', { name: /delete deadline/i })
      fireEvent.click(deleteBtn)
      expect(screen.getByText('Are you sure?')).toBeDefined()

      // Advance time by 8 seconds + 1ms, wrapping in act to flush React updates
      act(() => {
        vi.advanceTimersByTime(8001)
      })

      // State should be reset to idle
      expect(screen.queryByText('Are you sure?')).toBeNull()
      expect(screen.getByRole('button', { name: /delete deadline/i })).toBeDefined()
    } finally {
      vi.useRealTimers()
    }
  })

  it('clicking outside (blur) resets confirm state to idle', () => {
    renderRow()
    // Enter confirm state
    const deleteBtn = screen.getByRole('button', { name: /delete deadline/i })
    fireEvent.click(deleteBtn)
    expect(screen.getByText('Are you sure?')).toBeDefined()

    // Fire blur on the confirm button — onBlur calls setDeleteStep('idle') directly
    const confirmBtn = screen.getByText('Are you sure?')
    act(() => {
      fireEvent.blur(confirmBtn)
    })

    expect(screen.queryByText('Are you sure?')).toBeNull()
  })
})
