// @vitest-environment jsdom
// Wave 0 stub — DeadlineRow component
// Plan 03-04 (Wave 3) converts these it.todo stubs to live it() tests.
//
// Requirements: VIEW-04 (row-level color shift for overdue/today deadlines)
// Design tokens: every row has a border-l-4 bar in its CASE color (useCaseColors);
//                overdue = bg-red-50 tint + red date; today = bg-amber-50 tint + amber date
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent } from '@testing-library/react'
import type { Deadline, DeadlineType } from '@/shared/schemas/deadline.js'
import { DeadlineRow } from './DeadlineRow.js'

afterEach(() => cleanup())

const TYPE_FILING: DeadlineType = { id: 1, name: 'Filing', color: '#1D4ED8', createdAt: '' }
const typesById = new Map([[1, TYPE_FILING]])
const caseColorOf = (_label: string) => '#FF0000' // test-controlled color

function makeDeadline(overrides: Partial<Deadline> = {}): Deadline {
  return {
    id: 1,
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

describe('DeadlineRow — Wave 0 stubs (VIEW-04)', () => {
  it('DR1: a past row (Past view) is quiet: no red alarm, no checkbox, "was due" label', () => {
    const { container } = render(
      <DeadlineRow
        deadline={makeDeadline()}
        bucket="overdue"
        typesById={typesById}
        caseColorOf={caseColorOf}
      />
    )
    const row = container.firstElementChild as HTMLElement
    expect(row.className).not.toContain('bg-red-50')
    expect(row.className).toContain('opacity-70')
    const dateSpan = Array.from(row.querySelectorAll('span')).find(el => el.textContent === 'Jun 15, 2026')
    expect(dateSpan!.className).not.toContain('text-red-700')
    expect(row.getAttribute('aria-label')).toContain('was due Jun 15, 2026')
    expect(container.querySelector('[role="checkbox"], button[role="checkbox"], input[type="checkbox"]')).toBeNull()
  })

  it('DR2: today row has bg-amber-50 tint + amber, bold date', () => {
    const { container } = render(
      <DeadlineRow
        deadline={makeDeadline()}
        bucket="today"
        typesById={typesById}
        caseColorOf={caseColorOf}
      />
    )
    const row = container.firstElementChild as HTMLElement
    expect(row.className).toContain('bg-amber-50')
    const dateSpan = Array.from(row.querySelectorAll('span')).find(el => el.textContent === 'Jun 15, 2026')
    expect(dateSpan!.className).toContain('text-amber-700')
  })

  it('DR3: default (future) row has no overdue/today tint', () => {
    const { container } = render(
      <DeadlineRow
        deadline={makeDeadline()}
        bucket="thisWeek"
        typesById={typesById}
        caseColorOf={caseColorOf}
      />
    )
    const row = container.firstElementChild as HTMLElement
    expect(row.className).not.toContain('bg-red-50')
    expect(row.className).not.toContain('bg-amber-50')
  })

  it('DR4: color-coded by case: left bar + case badge use caseColorOf(caseLabel); type is plain text', () => {
    // jsdom preserves named colors in inline styles
    const seen: string[] = []
    const byCase = (label: string) => { seen.push(label); return 'green' }
    const { container } = render(
      <DeadlineRow
        deadline={makeDeadline()}
        bucket="thisWeek"
        typesById={typesById}
        caseColorOf={byCase}
      />
    )
    expect(seen).toContain('Smith v. Jones')
    const row = container.firstElementChild as HTMLElement
    expect(row.className).toContain('border-l-4')
    expect(row.style.borderLeftColor).toBe('green')
    const badge = container.querySelector('[data-testid="case-badge"]') as HTMLElement
    expect(badge.textContent).toBe('Smith v. Jones')
    expect(badge.style.backgroundColor).toBe('green')
    expect(container.textContent).toContain('Filing')
  })
})

describe('POLISH-04: DeadlineRow Duplicate row action', () => {
  it('DR-DUP-1: Duplicate button is in the DOM when onDuplicate is provided and uses hover-reveal + focus-visible classes', () => {
    const onDuplicate = vi.fn()
    const { container } = render(
      <DeadlineRow
        deadline={makeDeadline()}
        bucket="thisWeek"
        typesById={typesById}
        caseColorOf={caseColorOf}
        onDuplicate={onDuplicate}
      />
    )
    const btn = container.querySelector('button[aria-label="Duplicate Smith v. Jones"]') as HTMLButtonElement | null
    expect(btn).not.toBeNull()
    expect(btn!.className).toContain('opacity-0')
    expect(btn!.className).toContain('group-hover:opacity-100')
    expect(btn!.className).toContain('focus-visible:opacity-100')
  })

  it('DR-DUP-2: Clicking Duplicate calls onDuplicate(deadline.id) and stops propagation (row onClick NOT fired)', () => {
    const onDuplicate = vi.fn()
    const onRowClick = vi.fn()
    const { container } = render(
      <DeadlineRow
        deadline={makeDeadline({ id: 42 })}
        bucket="thisWeek"
        typesById={typesById}
        caseColorOf={caseColorOf}
        onDuplicate={onDuplicate}
        onRowClick={onRowClick}
      />
    )
    const btn = container.querySelector('button[aria-label="Duplicate Smith v. Jones"]') as HTMLButtonElement
    fireEvent.click(btn)
    expect(onDuplicate).toHaveBeenCalledTimes(1)
    expect(onDuplicate).toHaveBeenCalledWith(42)
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it('DR-DUP-3: Duplicate button not rendered when onDuplicate prop is omitted', () => {
    const { container } = render(
      <DeadlineRow
        deadline={makeDeadline()}
        bucket="thisWeek"
        typesById={typesById}
        caseColorOf={caseColorOf}
      />
    )
    expect(container.querySelector('button[aria-label="Duplicate Smith v. Jones"]')).toBeNull()
  })

  it('DR-DUP-4: Delete button has focus-visible:opacity-100 (Pitfall 7 regression guard)', () => {
    const { container } = render(
      <DeadlineRow
        deadline={makeDeadline()}
        bucket="thisWeek"
        typesById={typesById}
        caseColorOf={caseColorOf}
        onDelete={() => {}}
      />
    )
    const del = container.querySelector('button[aria-label="Delete deadline Smith v. Jones"]') as HTMLButtonElement
    expect(del).not.toBeNull()
    expect(del.className).toContain('focus-visible:opacity-100')
  })
})
