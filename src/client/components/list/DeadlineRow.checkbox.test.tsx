// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import type { Deadline, DeadlineType } from '@/shared/schemas/deadline.js'
import { DeadlineRow } from './DeadlineRow.js'

// CRUD-05/07: DeadlineRow per-row checkbox for mark/unmark complete

afterEach(() => cleanup())

const TYPE_FILING: DeadlineType = { id: 1, name: 'Filing', color: '#374151', createdAt: '' }
const typesById = new Map([[1, TYPE_FILING]])
const caseColorOf = (_label: string) => '#374151'

function makeDeadline(overrides: Partial<Deadline> = {}): Deadline {
  return {
    id: 7,
    date: '2026-06-15',
    caseLabel: 'Garcia v. City',
    typeId: 1,
    description: null,
    completedAt: null,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  }
}

function renderRow(
  deadline: Deadline,
  callbacks: {
    onComplete?: (id: number, completed: boolean) => void
    onRowClick?: (id: number) => void
    onDelete?: (id: number) => void
  } = {}
) {
  return render(
    <DeadlineRow
      deadline={deadline}
      bucket="thisWeek"
      typesById={typesById}
      caseColorOf={caseColorOf}
      {...callbacks}
    />
  )
}

describe('CRUD-05/07: DeadlineRow — mark/unmark complete checkbox', () => {
  it('checkbox is unchecked when completedAt === null', () => {
    const deadline = makeDeadline({ completedAt: null })
    renderRow(deadline)
    const checkbox = screen.getByRole('checkbox')
    // Radix Checkbox uses data-state attribute
    expect(checkbox.getAttribute('data-state')).toBe('unchecked')
  })

  it('checkbox is checked when completedAt is a non-null timestamp', () => {
    const deadline = makeDeadline({ completedAt: '2026-05-23T12:00:00Z' })
    renderRow(deadline)
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox.getAttribute('data-state')).toBe('checked')
  })

  it('clicking checkbox calls onComplete(id, true) when marking complete', () => {
    const onComplete = vi.fn()
    const deadline = makeDeadline({ completedAt: null })
    renderRow(deadline, { onComplete })

    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith(7, true)
  })

  it('clicking checkbox calls onComplete(id, false) when marking incomplete', () => {
    const onComplete = vi.fn()
    const deadline = makeDeadline({ completedAt: '2026-05-23T12:00:00Z' })
    renderRow(deadline, { onComplete })

    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)

    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith(7, false)
  })

  it('clicking checkbox does NOT call onRowClick (stopPropagation)', () => {
    const onRowClick = vi.fn()
    const onComplete = vi.fn()
    const deadline = makeDeadline({ completedAt: null })
    renderRow(deadline, { onRowClick, onComplete })

    const checkbox = screen.getByRole('checkbox')
    fireEvent.click(checkbox)

    // onComplete may or may not be called depending on Radix internals,
    // but onRowClick must NOT be called
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('aria-label says "Mark X complete" when not yet completed', () => {
    const deadline = makeDeadline({ completedAt: null })
    renderRow(deadline)
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox.getAttribute('aria-label')).toBe('Mark Garcia v. City complete')
  })

  it('aria-label says "Mark X incomplete" when already completed', () => {
    const deadline = makeDeadline({ completedAt: '2026-05-23T12:00:00Z' })
    renderRow(deadline)
    const checkbox = screen.getByRole('checkbox')
    expect(checkbox.getAttribute('aria-label')).toBe('Mark Garcia v. City incomplete')
  })

  it('completed row has opacity-50 on container', () => {
    const deadline = makeDeadline({ completedAt: '2026-05-23T12:00:00Z' })
    const { container } = renderRow(deadline)
    const row = container.firstElementChild as HTMLElement
    expect(row.className).toContain('opacity-50')
  })

  it('completed row case label has line-through', () => {
    const deadline = makeDeadline({ completedAt: '2026-05-23T12:00:00Z' })
    const { container } = renderRow(deadline)
    const caseSpan = Array.from(container.querySelectorAll('span')).find(el =>
      el.textContent === 'Garcia v. City'
    ) as HTMLElement
    expect(caseSpan).toBeDefined()
    expect(caseSpan.className).toContain('line-through')
  })

  it('completed row has data-completed="true"', () => {
    const deadline = makeDeadline({ completedAt: '2026-05-23T12:00:00Z' })
    const { container } = renderRow(deadline)
    const row = container.firstElementChild as HTMLElement
    expect(row.getAttribute('data-completed')).toBe('true')
  })

  it('non-completed row does NOT have data-completed attribute', () => {
    const deadline = makeDeadline({ completedAt: null })
    const { container } = renderRow(deadline)
    const row = container.firstElementChild as HTMLElement
    expect(row.getAttribute('data-completed')).toBeNull()
  })
})
