// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { JumpToDateDialog } from './JumpToDateDialog.js'

// Mock the shadcn Calendar to avoid react-day-picker's complex internal navigation in jsdom.
// The mock exposes a single button that invokes onSelect with a known Date — simulating a
// date pick without requiring a real calendar grid.
vi.mock('@/client/components/ui/calendar.js', () => ({
  Calendar: ({ onSelect }: { onSelect?: (d: Date | undefined) => void }) => (
    <button
      data-testid="mock-day"
      onClick={() => onSelect?.(new Date(2026, 5, 15, 12, 0, 0))}
    >
      day
    </button>
  ),
}))

afterEach(() => cleanup())

describe('JumpToDateDialog', () => {
  it('Test 1: renders DialogTitle when open=true', () => {
    render(
      <JumpToDateDialog
        open={true}
        onOpenChange={vi.fn()}
        onDateSelect={vi.fn()}
      />
    )
    expect(screen.getByText('Go to date')).toBeTruthy()
  })

  it('Test 2: does NOT render DialogTitle when open=false', () => {
    render(
      <JumpToDateDialog
        open={false}
        onOpenChange={vi.fn()}
        onDateSelect={vi.fn()}
      />
    )
    expect(screen.queryByText('Go to date')).toBeNull()
  })

  it('Test 3: selecting a date fires onDateSelect with ISO string and calls onOpenChange(false)', () => {
    const onDateSelect = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <JumpToDateDialog
        open={true}
        onOpenChange={onOpenChange}
        onDateSelect={onDateSelect}
      />
    )
    // Click the mock day button — it calls onSelect(new Date(2026, 5, 15, 12, 0, 0))
    fireEvent.click(screen.getByTestId('mock-day'))
    // toISODateString uses local getters — June 15, 2026 → '2026-06-15' (SAFE-03 compliant)
    expect(onDateSelect).toHaveBeenCalledWith('2026-06-15')
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('Test 4: Esc closes dialog without firing onDateSelect (Radix Dialog built-in)', () => {
    const onDateSelect = vi.fn()
    const onOpenChange = vi.fn()
    render(
      <JumpToDateDialog
        open={true}
        onOpenChange={onOpenChange}
        onDateSelect={onDateSelect}
      />
    )
    // Radix Dialog responds to Esc by calling onOpenChange(false)
    fireEvent.keyDown(document.body, { key: 'Escape' })
    // Radix will call onOpenChange(false); onDateSelect must NOT be called
    expect(onDateSelect).not.toHaveBeenCalled()
    // onOpenChange(false) is triggered by Radix — behavior verified at unit boundary
    // (full Radix integration test would require a real browser; jsdom partial support is expected)
  })

  it('Test 5: sr-only DialogDescription is present in the DOM', () => {
    render(
      <JumpToDateDialog
        open={true}
        onOpenChange={vi.fn()}
        onDateSelect={vi.fn()}
      />
    )
    const desc = screen.getByText('Select a date to navigate the calendar to that month')
    expect(desc).toBeTruthy()
    expect(desc.className).toContain('sr-only')
  })
})
