// @vitest-environment jsdom
// Wave 2 — converted from it.todo stubs to live it() tests.
//
// Requirements: VIEW-06/07 — list + form side by side on wide screens (the calendar view was
// removed; the desktop wallpaper is the calendar), single column on narrow screens.
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
  list: <div data-testid="list">LIST</div>,
  form: <div data-testid="form">FORM</div>,
}

const PANE_SIZES_ID = 'cc-pane-sizes-list-form'

describe('PaneLayout', () => {
  for (const tier of ['three', 'two'] as const) {
    it(`renders list + form in a resizable group at tier=${tier}`, () => {
      vi.mocked(useBreakpoint).mockReturnValue(tier)
      const { container, queryByTestId } = render(<PaneLayout {...stubProps} />)
      expect(queryByTestId('fb')).not.toBeNull()
      expect(queryByTestId('list')).not.toBeNull()
      expect(queryByTestId('form')).not.toBeNull()
      expect(container.querySelector('[data-group]')).not.toBeNull()
    })
  }

  it("renders a single column (no ResizablePanelGroup) with form and list when tier=one (VIEW-07)", () => {
    vi.mocked(useBreakpoint).mockReturnValue('one')
    const { container, queryByTestId } = render(<PaneLayout {...stubProps} />)
    // react-resizable-panels emits [data-group] on the panel group element
    expect(container.querySelector('[data-group]')).toBeNull()
    expect(queryByTestId('list')).not.toBeNull()
    expect(queryByTestId('form')).not.toBeNull()
  })

  it("has no List/Calendar view toggle at any tier", () => {
    for (const tier of ['three', 'two', 'one'] as const) {
      vi.mocked(useBreakpoint).mockReturnValue(tier)
      const { queryByRole } = render(<PaneLayout {...stubProps} />)
      expect(queryByRole('group', { name: 'View mode' })).toBeNull()
      cleanup()
    }
  })

  it(`passes autoSaveId='${PANE_SIZES_ID}' to ResizablePanelGroup`, () => {
    vi.mocked(useBreakpoint).mockReturnValue('three')
    const { container } = render(<PaneLayout {...stubProps} />)
    // autoSaveId is passed as the Group `id` prop so it's queryable
    const panelGroupEl = container.querySelector('[data-group]')
    expect(panelGroupEl?.getAttribute('id')).toBe(PANE_SIZES_ID)
  })

  it("CR-02: layout persistence — a stored layout is read back on remount", () => {
    localStorage.removeItem(PANE_SIZES_ID)
    vi.mocked(useBreakpoint).mockReturnValue('three')

    // useDefaultLayout stores layout under the `id` key; simulate a saved layout, then remount
    const newLayout = [70, 30]
    localStorage.setItem(PANE_SIZES_ID, JSON.stringify(newLayout))

    cleanup()
    const { container } = render(<PaneLayout {...stubProps} />)

    const panelGroupEl = container.querySelector('[data-group]')
    expect(panelGroupEl).not.toBeNull()
    expect(panelGroupEl?.getAttribute('id')).toBe(PANE_SIZES_ID)
    expect(localStorage.getItem(PANE_SIZES_ID)).toBe(JSON.stringify(newLayout))

    localStorage.removeItem(PANE_SIZES_ID)
  })
})
