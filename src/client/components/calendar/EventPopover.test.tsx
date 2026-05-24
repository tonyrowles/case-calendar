// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import { EventPopover } from './EventPopover.js'
import type { EventPopoverEvent } from './EventPopover.js'

afterEach(() => cleanup())

const MOCK_EVENT: EventPopoverEvent = {
  id: 7,
  caseLabel: 'Smith v. Jones',
  typeId: 1,
  typeName: 'Filing',
  date: '2026-06-15',
  description: 'Motion hearing',
}

const getColor = (_typeId: number) => '#1D4ED8'

describe('POLISH-04: EventPopover Duplicate button', () => {
  it('EP1: renders without onDuplicate prop — no Duplicate button', () => {
    render(<EventPopover event={MOCK_EVENT} getColor={getColor} />)
    expect(screen.getByText('Smith v. Jones')).toBeTruthy()
    expect(screen.getByText('Filing')).toBeTruthy()
    expect(screen.queryByText('Duplicate Deadline')).toBeNull()
    expect(screen.queryByLabelText('Duplicate this deadline')).toBeNull()
  })

  it('EP2: Duplicate button renders and calls onDuplicate with deadlineId', () => {
    const onDuplicate = vi.fn()
    render(<EventPopover event={MOCK_EVENT} getColor={getColor} onDuplicate={onDuplicate} />)
    const btn = screen.getByText('Duplicate Deadline')
    expect(btn).toBeTruthy()
    expect(screen.getByLabelText('Duplicate this deadline')).toBeTruthy()
    fireEvent.click(btn)
    expect(onDuplicate).toHaveBeenCalledTimes(1)
    expect(onDuplicate).toHaveBeenCalledWith(7)
  })
})
