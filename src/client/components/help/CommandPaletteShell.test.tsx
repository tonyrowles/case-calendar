// @vitest-environment jsdom
// Wave 2 — converted from it.todo stubs to live it() tests.
//
// Requirements: KBD-09 (empty Cmd+K palette shell)
import React from 'react'
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { CommandPaletteShell } from './CommandPaletteShell.js'

// cmdk uses ResizeObserver + scrollIntoView; Radix Dialog uses pointer-capture
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

describe('CommandPaletteShell', () => {
  it("renders empty CommandInput placeholder when open=true (KBD-09)", () => {
    render(<CommandPaletteShell open={true} onOpenChange={vi.fn()} />)
    expect(screen.queryByPlaceholderText('Quick command…')).not.toBeNull()
    expect(screen.queryByText('No suggestions yet — Phase 11 wires this in.')).not.toBeNull()
  })

  it("does not render content when open=false", () => {
    render(<CommandPaletteShell open={false} onOpenChange={vi.fn()} />)
    expect(screen.queryByPlaceholderText('Quick command…')).toBeNull()
  })

  it("closes via onOpenChange when Esc is pressed", () => {
    const onOpenChange = vi.fn()
    render(<CommandPaletteShell open={true} onOpenChange={onOpenChange} />)
    const target = document.activeElement || document.body
    fireEvent.keyDown(target, { key: 'Escape', code: 'Escape' })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
