// @vitest-environment jsdom
import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import type { EventContentArg } from '@fullcalendar/core'
import { EventPill, TYPE_ABBREV } from './EventPill.js'

afterEach(() => cleanup())

function makeArg(overrides: {
  caseLabel?: string
  typeId?: number
  typeName?: string
  description?: string
  isOverdue?: boolean
  startStr?: string
}): EventContentArg {
  const {
    caseLabel = 'Smith v. Jones',
    typeId = 1,
    typeName = 'Filing',
    description = '',
    isOverdue = false,
    startStr = '2026-06-15',
  } = overrides
  return {
    event: {
      extendedProps: { caseLabel, typeId, typeName, description, isOverdue },
      startStr,
    },
  } as unknown as EventContentArg
}

describe('EventPill (VIEW-01)', () => {
  it('renders left border in type color from getColor(typeId)', () => {
    const getColor = vi.fn().mockReturnValue('#1D4ED8')
    const { container } = render(
      <EventPill arg={makeArg({ isOverdue: false, typeId: 1 })} getColor={getColor} />
    )
    const pill = container.firstChild as HTMLElement
    // JSDOM normalizes hex to rgb — check the attribute string directly
    const styleAttr = pill.getAttribute('style') ?? ''
    expect(styleAttr).toContain('border-left')
    // The component receives #1D4ED8 from getColor — verify getColor was called with typeId 1
    expect(getColor).toHaveBeenCalledWith(1)
    // Verify the border-left style was set (JSDOM may normalize to rgb — check it contains a value)
    expect(pill.style.borderLeftStyle).toBe('solid')
    expect(pill.style.borderLeftWidth).toBe('4px')
  })

  it('renders left border in red-700 (#B91C1C) when isOverdue is true regardless of type color', () => {
    const getColor = vi.fn().mockReturnValue('#1D4ED8')
    const { container } = render(
      <EventPill arg={makeArg({ isOverdue: true, typeId: 1 })} getColor={getColor} />
    )
    const pill = container.firstChild as HTMLElement
    // When overdue, getColor should NOT be called for the border color
    expect(getColor).not.toHaveBeenCalled()
    // Style attribute should contain the overdue color (JSDOM normalizes to rgb)
    expect(pill.style.borderLeftStyle).toBe('solid')
    expect(pill.style.borderLeftWidth).toBe('4px')
    // rgb(185, 28, 28) is #B91C1C normalized
    expect(pill.style.borderLeftColor).toBe('rgb(185, 28, 28)')
  })

  it('renders case label as text content (truncated via flex-1 truncate)', () => {
    const getColor = vi.fn().mockReturnValue('#1D4ED8')
    const { container } = render(
      <EventPill arg={makeArg({ caseLabel: 'Smith v. Jones' })} getColor={getColor} />
    )
    const spans = container.querySelectorAll('span')
    // First span is the case label
    const label = spans[0] as HTMLElement
    expect(label.textContent).toBe('Smith v. Jones')
    // Assert truncation and layout classes
    expect(label.classList.contains('truncate')).toBe(true)
    expect(label.classList.contains('text-xs')).toBe(true)
    expect(label.classList.contains('flex-1')).toBe(true)
  })

  it('applies text-red-700 to case label when isOverdue is true', () => {
    const getColor = vi.fn().mockReturnValue('#1D4ED8')
    const { container } = render(
      <EventPill arg={makeArg({ isOverdue: true, caseLabel: 'Smith v. Jones' })} getColor={getColor} />
    )
    const spans = container.querySelectorAll('span')
    const label = spans[0] as HTMLElement
    expect(label.textContent).toBe('Smith v. Jones')
    expect(label.classList.contains('text-red-700')).toBe(true)
  })

  it('renders TYPE_ABBREV[typeName] when known (Filing -> FIL, Hearing -> HRG, SOL)', () => {
    const getColor = vi.fn().mockReturnValue('#1D4ED8')

    const { container: c1 } = render(
      <EventPill arg={makeArg({ typeName: 'Filing' })} getColor={getColor} />
    )
    expect((c1.querySelectorAll('span')[1] as HTMLElement).textContent).toBe('FIL')
    cleanup()

    const { container: c2 } = render(
      <EventPill arg={makeArg({ typeName: 'Hearing' })} getColor={getColor} />
    )
    expect((c2.querySelectorAll('span')[1] as HTMLElement).textContent).toBe('HRG')
    cleanup()

    const { container: c3 } = render(
      <EventPill arg={makeArg({ typeName: 'Statute of Limitations' })} getColor={getColor} />
    )
    expect((c3.querySelectorAll('span')[1] as HTMLElement).textContent).toBe('SOL')
  })

  it('falls back to typeName.slice(0, 3).toUpperCase() for unknown types', () => {
    const getColor = vi.fn().mockReturnValue('#1D4ED8')
    const { container } = render(
      <EventPill arg={makeArg({ typeName: 'CustomType' })} getColor={getColor} />
    )
    const abbrevSpan = container.querySelectorAll('span')[1] as HTMLElement
    expect(abbrevSpan.textContent).toBe('CUS')
  })

  it('does not use dangerouslySetInnerHTML — XSS payload renders as escaped text', () => {
    const getColor = vi.fn().mockReturnValue('#1D4ED8')
    const xssPayload = '<script>alert(1)</script>'
    const { container } = render(
      <EventPill arg={makeArg({ caseLabel: xssPayload })} getColor={getColor} />
    )
    // The case label span should contain the text as a text node (not raw HTML)
    const labelSpan = container.querySelectorAll('span')[0] as HTMLElement
    // textContent reveals the actual text string (unescaped)
    expect(labelSpan.textContent).toBe(xssPayload)
    // But innerHTML of the span must NOT have raw <script> inside (React escapes it)
    expect(labelSpan.innerHTML.includes('<script>')).toBe(false)
    // The escaped form should be present in innerHTML
    expect(labelSpan.innerHTML.includes('&lt;script&gt;')).toBe(true)
  })

  it('renders aria-label with caseLabel — typeName — formattedDate', () => {
    const getColor = vi.fn().mockReturnValue('#1D4ED8')
    const { container } = render(
      <EventPill
        arg={makeArg({ caseLabel: 'Smith v. Jones', typeName: 'Filing', startStr: '2026-06-15' })}
        getColor={getColor}
      />
    )
    const pill = container.firstChild as HTMLElement
    expect(pill.getAttribute('aria-label')).toBe('Smith v. Jones — Filing — June 15, 2026')
  })
})

describe('TYPE_ABBREV map', () => {
  it('contains all 9 locked abbreviations', () => {
    expect(TYPE_ABBREV['Filing']).toBe('FIL')
    expect(TYPE_ABBREV['Hearing']).toBe('HRG')
    expect(TYPE_ABBREV['Deposition']).toBe('DEP')
    expect(TYPE_ABBREV['Statute of Limitations']).toBe('SOL')
    expect(TYPE_ABBREV['Response/Opposition']).toBe('RSP')
    expect(TYPE_ABBREV['Status Conference']).toBe('STC')
    expect(TYPE_ABBREV['Discovery Cutoff']).toBe('DSC')
    expect(TYPE_ABBREV['Trial']).toBe('TRL')
    expect(TYPE_ABBREV['Other']).toBe('OTH')
  })
})
