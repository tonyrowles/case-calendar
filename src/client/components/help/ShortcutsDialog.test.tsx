// @vitest-environment jsdom
// Wave 2 — converted from it.todo stubs to live it() tests.
//
// Requirements: KBD-07 (keyboard shortcuts help overlay)
import React from 'react'
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { ShortcutsDialog } from './ShortcutsDialog.js'

// Radix Dialog uses pointer-capture APIs; polyfill for jsdom
beforeAll(() => {
  if (typeof window !== 'undefined') {
    if (!window.ResizeObserver) {
      window.ResizeObserver = class ResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
      }
    }
    if (!HTMLElement.prototype.scrollIntoView) {
      HTMLElement.prototype.scrollIntoView = function () {}
    }
    if (!HTMLElement.prototype.hasPointerCapture) {
      HTMLElement.prototype.hasPointerCapture = function () { return false }
    }
    if (!HTMLElement.prototype.setPointerCapture) {
      HTMLElement.prototype.setPointerCapture = function () {}
    }
    if (!HTMLElement.prototype.releasePointerCapture) {
      HTMLElement.prototype.releasePointerCapture = function () {}
    }
  }
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('ShortcutsDialog', () => {
  it("renders all 8 keyboard shortcut keys when open=true (KBD-07)", () => {
    render(<ShortcutsDialog open={true} onOpenChange={vi.fn()} />)
    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeNull()
    // 7 rows covering 8 keys (j/k share a row, ⌘K/Ctrl+K share a row); t/g went with the calendar view
    expect(screen.getAllByRole('row')).toHaveLength(7)
    // Radix portals content to document.body — query kbd from document, not container
    const kbdTexts = Array.from(document.querySelectorAll('kbd')).map(el => el.textContent)
    const expectedKeys = ['n', 'e', 'Delete', 'j', 'k', '?', '⌘K', 'Esc']
    for (const key of expectedKeys) {
      expect(kbdTexts).toContain(key)
    }
  })

  it("does not render content when open=false", () => {
    render(<ShortcutsDialog open={false} onOpenChange={vi.fn()} />)
    expect(screen.queryByText('Keyboard Shortcuts')).toBeNull()
  })

  it("closes via onOpenChange when Esc is pressed (Radix default behavior)", () => {
    const onOpenChange = vi.fn()
    render(<ShortcutsDialog open={true} onOpenChange={onOpenChange} />)
    // Fire Escape on the active element (dialog content manages focus in Radix)
    const target = document.activeElement || document.body
    fireEvent.keyDown(target, { key: 'Escape', code: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
