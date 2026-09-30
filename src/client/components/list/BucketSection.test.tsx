// @vitest-environment jsdom
// Wave 0 stub — BucketSection component
// Plan 03-04 (Wave 3) converts these it.todo stubs to live it() tests.
//
// Requirements: VIEW-03 (collapse/expand bucket, empty bucket hiding)
import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import type { Deadline, DeadlineType } from '@/shared/schemas/deadline.js'
import { BucketSection } from './BucketSection.js'

afterEach(() => cleanup())

const TYPE_FILING: DeadlineType = { id: 1, name: 'Filing', color: '#1D4ED8', createdAt: '' }
const typesById = new Map([[1, TYPE_FILING]])
const caseColorOf = (_label: string) => '#1D4ED8'

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

const sampleDeadlines = [
  makeDeadline({ id: 1 }),
  makeDeadline({ id: 2, caseLabel: 'Garcia v. City' }),
  makeDeadline({ id: 3, caseLabel: 'Lee v. Corp' }),
]

describe('BucketSection — Wave 0 stubs (VIEW-03)', () => {
  it('BS1: default open — bucket body is visible on initial render (aria-expanded=true)', () => {
    render(
      <BucketSection
        bucketId="overdue"
        bucketLabel="Overdue"
        deadlines={sampleDeadlines}
        typesById={typesById}
        caseColorOf={caseColorOf}
      />
    )
    // Use expanded:true to find the toggle button specifically
    const button = screen.getByRole('button', { expanded: true })
    expect(button.getAttribute('aria-expanded')).toBe('true')
    // The body region should exist
    const body = document.getElementById('bucket-overdue-body')
    expect(body).not.toBeNull()
  })

  it('BS2: click header toggles aria-expanded — second click hides the bucket body', () => {
    render(
      <BucketSection
        bucketId="overdue"
        bucketLabel="Overdue"
        deadlines={sampleDeadlines}
        typesById={typesById}
        caseColorOf={caseColorOf}
      />
    )
    const button = screen.getByRole('button', { expanded: true })
    // Initially open
    expect(button.getAttribute('aria-expanded')).toBe('true')
    // Click to collapse
    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('false')
    // Body should be gone
    const body = document.getElementById('bucket-overdue-body')
    expect(body).toBeNull()
  })

  it('BS3: body region has correct role="rowgroup" and aria-label', () => {
    render(
      <BucketSection
        bucketId="overdue"
        bucketLabel="Overdue"
        deadlines={sampleDeadlines}
        typesById={typesById}
        caseColorOf={caseColorOf}
      />
    )
    const body = document.getElementById('bucket-overdue-body')
    expect(body).not.toBeNull()
    expect(body!.getAttribute('role')).toBe('rowgroup')
    expect(body!.getAttribute('aria-label')).toBe('Overdue deadlines')
  })

  it('BS4: header shows bucket name and count — e.g. "Overdue 3"', () => {
    render(
      <BucketSection
        bucketId="overdue"
        bucketLabel="Overdue"
        deadlines={sampleDeadlines}
        typesById={typesById}
        caseColorOf={caseColorOf}
      />
    )
    // Bucket name
    expect(screen.getByText('Overdue')).toBeDefined()
    // Count
    expect(screen.getByText('3')).toBeDefined()
  })
})
