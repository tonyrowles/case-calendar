// @vitest-environment jsdom
// Wave 2 — converted from it.todo stubs to live it() tests.
//
// Requirements: VIEW-06 (3-pane at >=1920px), VIEW-07 (responsive breakpoint switching)
import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { PaneLayout } from './PaneLayout.js'

vi.mock('@/client/hooks/useBreakpoint.js', () => ({
  useBreakpoint: vi.fn(),
}))

// react-resizable-panels uses ResizeObserver internally — polyfill for jsdom
beforeEach(() => {
  if (typeof window !== 'undefined') {
    if (!window.ResizeObserver) {
      window.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    }
  }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

import { useBreakpoint } from '@/client/hooks/useBreakpoint.js'

const stubProps = {
  filterBar: <div data-testid="fb">FB</div>,
  calendar: <div data-testid="cal">CAL</div>,
  list: <div data-testid="list">LIST</div>,
  form: <div data-testid="form">FORM</div>,
  view: 'list' as const,
  onViewChange: vi.fn(),
}

describe('PaneLayout', () => {
  it("renders three panels when tier=three (VIEW-06)", () => {
    vi.mocked(useBreakpoint).mockReturnValue('three')
    const { queryByTestId } = render(<PaneLayout {...stubProps} />)
    expect(queryByTestId('cal')).not.toBeNull()
    expect(queryByTestId('list')).not.toBeNull()
    expect(queryByTestId('form')).not.toBeNull()
  })

  it("renders two panels when tier=two", () => {
    vi.mocked(useBreakpoint).mockReturnValue('two')
    // view='list' so list slot should render, not calendar
    const { queryByTestId } = render(<PaneLayout {...stubProps} view="list" />)
    expect(queryByTestId('list')).not.toBeNull()
    expect(queryByTestId('form')).not.toBeNull()
    // calendar slot should NOT render at tier=two when view='list'
    expect(queryByTestId('cal')).toBeNull()
  })

  it("renders one panel (single column, no ResizablePanelGroup) when tier=one (VIEW-07)", () => {
    vi.mocked(useBreakpoint).mockReturnValue('one')
    const { container } = render(<PaneLayout {...stubProps} />)
    // react-resizable-panels v2 emits [data-group] on the panel group element
    const panelGroup = container.querySelector('[data-group]')
    expect(panelGroup).toBeNull()
  })

  it("view toggle is hidden at tier=three", () => {
    vi.mocked(useBreakpoint).mockReturnValue('three')
    const { queryByRole } = render(<PaneLayout {...stubProps} />)
    expect(queryByRole('group', { name: 'View mode' })).toBeNull()
  })

  it("view toggle is visible at tier=two", () => {
    vi.mocked(useBreakpoint).mockReturnValue('two')
    const { queryByRole } = render(<PaneLayout {...stubProps} />)
    expect(queryByRole('group', { name: 'View mode' })).not.toBeNull()
  })

  it("view toggle is visible at tier=one", () => {
    vi.mocked(useBreakpoint).mockReturnValue('one')
    const { queryByRole } = render(<PaneLayout {...stubProps} />)
    expect(queryByRole('group', { name: 'View mode' })).not.toBeNull()
  })

  it("passes autoSaveId='cc-pane-sizes' to ResizablePanelGroup at tier=three", () => {
    vi.mocked(useBreakpoint).mockReturnValue('three')
    const { container } = render(<PaneLayout {...stubProps} />)
    // react-resizable-panels v2 emits [data-group] on the Group element;
    // we also pass autoSaveId as the `id` prop so it's queryable
    const panelGroupEl = container.querySelector('[data-group]')
    expect(panelGroupEl).not.toBeNull()
    expect(panelGroupEl?.getAttribute('id')).toBe('cc-pane-sizes')
  })
})
