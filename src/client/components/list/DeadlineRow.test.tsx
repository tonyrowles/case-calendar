// @vitest-environment jsdom
// Wave 0 stub — DeadlineRow component
// Plan 03-04 (Wave 3) converts these it.todo stubs to live it() tests.
//
// Requirements: VIEW-04 (row-level color shift for overdue/today deadlines)
// Design tokens: overdue = bg-red-50 + border-l-4 border-red-700 + text-red-700
//                today   = bg-amber-50 + border-l-4 border-amber-500 + text-amber-700
//                other   = bg-card, no left border
import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import type { Deadline, DeadlineType } from '@/shared/schemas/deadline.js'
import { DeadlineRow } from './DeadlineRow.js'

afterEach(() => cleanup())

const TYPE_FILING: DeadlineType = { id: 1, name: 'Filing', color: '#1D4ED8', createdAt: '' }
const typesById = new Map([[1, TYPE_FILING]])
const getColor = (_id: number) => '#FF0000' // test-controlled color

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
  it('DR1: overdue row has bg-red-50 background + border-l-4 border-red-700 left edge + text-red-700 text color', () => {
    const { container } = render(
      <DeadlineRow
        deadline={makeDeadline()}
        bucket="overdue"
        typesById={typesById}
        getColor={getColor}
      />
    )
    const row = container.firstElementChild as HTMLElement
    expect(row.className).toContain('bg-red-50')
    expect(row.className).toContain('border-l-4')
    expect(row.className).toContain('border-l-red-700')
    // Case label text color
    const caseSpan = Array.from(row.querySelectorAll('span')).find(el =>
      el.textContent === 'Smith v. Jones'
    )
    expect(caseSpan).toBeDefined()
    expect(caseSpan!.className).toContain('text-red-700')
  })

  it('DR2: today row has bg-amber-50 background + border-l-4 border-amber-500 left edge + text-amber-700 text color', () => {
    const { container } = render(
      <DeadlineRow
        deadline={makeDeadline()}
        bucket="today"
        typesById={typesById}
        getColor={getColor}
      />
    )
    const row = container.firstElementChild as HTMLElement
    expect(row.className).toContain('bg-amber-50')
    expect(row.className).toContain('border-l-4')
    expect(row.className).toContain('border-l-amber-500')
    // Case label text color
    const caseSpan = Array.from(row.querySelectorAll('span')).find(el =>
      el.textContent === 'Smith v. Jones'
    )
    expect(caseSpan).toBeDefined()
    expect(caseSpan!.className).toContain('text-amber-700')
  })

  it('DR3: default (future) row has bg-card background and no left border classes', () => {
    const { container } = render(
      <DeadlineRow
        deadline={makeDeadline()}
        bucket="thisWeek"
        typesById={typesById}
        getColor={getColor}
      />
    )
    const row = container.firstElementChild as HTMLElement
    expect(row.className).not.toContain('bg-red-50')
    expect(row.className).not.toContain('bg-amber-50')
    expect(row.className).not.toContain('border-l-4')
  })

  it('DR4: type color dot uses inline style={{ backgroundColor: color }} — no hardcoded hex (TYPE-06)', () => {
    // Use a color that maps predictably in jsdom (rgb(0, 128, 0) = green)
    const customColor = 'green'
    const customGetColor = (_id: number) => customColor
    const { container } = render(
      <DeadlineRow
        deadline={makeDeadline()}
        bucket="thisWeek"
        typesById={typesById}
        getColor={customGetColor}
      />
    )
    // Find the color dot (aria-hidden span without text)
    const dots = container.querySelectorAll('span[aria-hidden="true"]')
    expect(dots.length).toBeGreaterThan(0)
    const dot = dots[0] as HTMLElement
    // jsdom normalizes hex to rgb() but preserves named colors — check for green
    expect(dot.style.backgroundColor).toBe(customColor)
  })
})
