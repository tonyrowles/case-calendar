// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { renderHook, cleanup } from '@testing-library/react'
import { useKeyboardShortcuts, type ShortcutHandlers } from './useKeyboardShortcuts.js'
import { fireEvent } from '@testing-library/react'

function makeHandlers(): ShortcutHandlers {
  return {
    onNewDeadline: vi.fn(),
    onEditSelected: vi.fn(),
    onDeleteSelected: vi.fn(),
    onMoveNext: vi.fn(),
    onMovePrev: vi.fn(),
    onOpenHelp: vi.fn(),
    onOpenCommandK: vi.fn(),
  }
}

afterEach(() => {
  cleanup()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('useKeyboardShortcuts', () => {
  it("n fires onNewDeadline (KBD-01)", () => {
    const handlers = makeHandlers()
    renderHook(() => useKeyboardShortcuts(handlers))

    fireEvent.keyDown(window, { key: 'n' })

    expect(handlers.onNewDeadline).toHaveBeenCalledOnce()
    // other handlers untouched
    expect(handlers.onEditSelected).not.toHaveBeenCalled()
    expect(handlers.onDeleteSelected).not.toHaveBeenCalled()
  })

  it("e fires onEditSelected (KBD-02)", () => {
    const handlers = makeHandlers()
    renderHook(() => useKeyboardShortcuts(handlers))

    fireEvent.keyDown(window, { key: 'e' })

    expect(handlers.onEditSelected).toHaveBeenCalledOnce()
    expect(handlers.onNewDeadline).not.toHaveBeenCalled()
  })

  it("Delete fires onDeleteSelected (KBD-03)", () => {
    const handlers = makeHandlers()
    renderHook(() => useKeyboardShortcuts(handlers))

    fireEvent.keyDown(window, { key: 'Delete' })

    expect(handlers.onDeleteSelected).toHaveBeenCalledOnce()
    expect(handlers.onNewDeadline).not.toHaveBeenCalled()
  })

  it("j fires onMoveNext (KBD-05)", () => {
    const handlers = makeHandlers()
    renderHook(() => useKeyboardShortcuts(handlers))

    fireEvent.keyDown(window, { key: 'j' })

    expect(handlers.onMoveNext).toHaveBeenCalledOnce()
    expect(handlers.onMovePrev).not.toHaveBeenCalled()
  })

  it("k fires onMovePrev (KBD-05)", () => {
    const handlers = makeHandlers()
    renderHook(() => useKeyboardShortcuts(handlers))

    // plain k (no metaKey/ctrlKey) → onMovePrev
    fireEvent.keyDown(window, { key: 'k' })

    expect(handlers.onMovePrev).toHaveBeenCalledOnce()
    expect(handlers.onMoveNext).not.toHaveBeenCalled()
    expect(handlers.onOpenCommandK).not.toHaveBeenCalled()
  })

  it("Esc is NOT intercepted by hook — Radix handles it (KBD-06)", () => {
    const handlers = makeHandlers()
    renderHook(() => useKeyboardShortcuts(handlers))

    fireEvent.keyDown(window, { key: 'Escape' })

    // None of the 8 handlers should have been called
    expect(handlers.onNewDeadline).not.toHaveBeenCalled()
    expect(handlers.onEditSelected).not.toHaveBeenCalled()
    expect(handlers.onDeleteSelected).not.toHaveBeenCalled()
    expect(handlers.onMoveNext).not.toHaveBeenCalled()
    expect(handlers.onMoveNext).not.toHaveBeenCalled()
    expect(handlers.onMovePrev).not.toHaveBeenCalled()
    expect(handlers.onOpenHelp).not.toHaveBeenCalled()
    expect(handlers.onOpenCommandK).not.toHaveBeenCalled()
  })

  it("? fires onOpenHelp (KBD-07)", () => {
    const handlers = makeHandlers()
    renderHook(() => useKeyboardShortcuts(handlers))

    fireEvent.keyDown(window, { key: '?' })

    expect(handlers.onOpenHelp).toHaveBeenCalledOnce()
    expect(handlers.onNewDeadline).not.toHaveBeenCalled()
  })

  it("Cmd+K fires onOpenCommandK (KBD-09)", () => {
    const handlers = makeHandlers()
    renderHook(() => useKeyboardShortcuts(handlers))

    fireEvent.keyDown(window, { key: 'k', metaKey: true })

    expect(handlers.onOpenCommandK).toHaveBeenCalledOnce()
    expect(handlers.onMovePrev).not.toHaveBeenCalled()
  })

  it("Ctrl+K fires onOpenCommandK (KBD-09)", () => {
    const handlers = makeHandlers()
    renderHook(() => useKeyboardShortcuts(handlers))

    fireEvent.keyDown(window, { key: 'k', ctrlKey: true })

    expect(handlers.onOpenCommandK).toHaveBeenCalledOnce()
    expect(handlers.onMovePrev).not.toHaveBeenCalled()
  })

  it("no handler fires when active element is INPUT (KBD-08)", () => {
    const handlers = makeHandlers()
    renderHook(() => useKeyboardShortcuts(handlers))

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    fireEvent.keyDown(input, { key: 'n' })
    fireEvent.keyDown(input, { key: 'e' })
    fireEvent.keyDown(input, { key: 'Delete' })
    fireEvent.keyDown(input, { key: 't' })
    fireEvent.keyDown(input, { key: 'j' })
    fireEvent.keyDown(input, { key: 'k' })
    fireEvent.keyDown(input, { key: '?' })

    expect(handlers.onNewDeadline).not.toHaveBeenCalled()
    expect(handlers.onEditSelected).not.toHaveBeenCalled()
    expect(handlers.onDeleteSelected).not.toHaveBeenCalled()
    expect(handlers.onMoveNext).not.toHaveBeenCalled()
    expect(handlers.onMoveNext).not.toHaveBeenCalled()
    expect(handlers.onMovePrev).not.toHaveBeenCalled()
    expect(handlers.onOpenHelp).not.toHaveBeenCalled()
  })

  it("no handler fires when active element is TEXTAREA (KBD-08)", () => {
    const handlers = makeHandlers()
    renderHook(() => useKeyboardShortcuts(handlers))

    const textarea = document.createElement('textarea')
    document.body.appendChild(textarea)
    textarea.focus()

    fireEvent.keyDown(textarea, { key: 'n' })
    fireEvent.keyDown(textarea, { key: 'Delete' })
    fireEvent.keyDown(textarea, { key: '?' })

    expect(handlers.onNewDeadline).not.toHaveBeenCalled()
    expect(handlers.onDeleteSelected).not.toHaveBeenCalled()
    expect(handlers.onOpenHelp).not.toHaveBeenCalled()
  })

  it("no handler fires when active element has contenteditable (KBD-08)", () => {
    const handlers = makeHandlers()
    renderHook(() => useKeyboardShortcuts(handlers))

    const div = document.createElement('div')
    div.contentEditable = 'true'
    document.body.appendChild(div)
    div.focus()

    fireEvent.keyDown(div, { key: 'n' })
    fireEvent.keyDown(div, { key: 'e' })
    fireEvent.keyDown(div, { key: '?' })

    expect(handlers.onNewDeadline).not.toHaveBeenCalled()
    expect(handlers.onEditSelected).not.toHaveBeenCalled()
    expect(handlers.onOpenHelp).not.toHaveBeenCalled()
  })

  it("Cmd+K still fires while typing in INPUT (KBD-09 exception)", () => {
    const handlers = makeHandlers()
    renderHook(() => useKeyboardShortcuts(handlers))

    const input = document.createElement('input')
    document.body.appendChild(input)
    input.focus()

    // Cmd+K should fire EVEN when inside an input
    fireEvent.keyDown(input, { key: 'k', metaKey: true })

    expect(handlers.onOpenCommandK).toHaveBeenCalledOnce()
    // The plain shortcuts should still be blocked
    expect(handlers.onMovePrev).not.toHaveBeenCalled()
  })

  describe("WR-01: TYPING_ROLES guard — Radix/cmdk interactive elements", () => {
    const blockedRoles = ['option', 'listbox', 'combobox', 'menu', 'menuitem', 'menuitemcheckbox'] as const

    for (const role of blockedRoles) {
      it(`no handler fires when focused element has role="${role}"`, () => {
        const handlers = makeHandlers()
        renderHook(() => useKeyboardShortcuts(handlers))

        const el = document.createElement('div')
        el.setAttribute('role', role)
        el.setAttribute('tabindex', '0')
        document.body.appendChild(el)
        el.focus()

        fireEvent.keyDown(el, { key: 'n' })
        fireEvent.keyDown(el, { key: 't' })
        fireEvent.keyDown(el, { key: 'j' })
        fireEvent.keyDown(el, { key: '?' })

        expect(handlers.onNewDeadline).not.toHaveBeenCalled()
        expect(handlers.onMoveNext).not.toHaveBeenCalled()
        expect(handlers.onMoveNext).not.toHaveBeenCalled()
        expect(handlers.onOpenHelp).not.toHaveBeenCalled()
      })
    }

    it("Cmd+K still fires even when focused element has role=listbox (KBD-09 exception)", () => {
      const handlers = makeHandlers()
      renderHook(() => useKeyboardShortcuts(handlers))

      const el = document.createElement('div')
      el.setAttribute('role', 'listbox')
      el.setAttribute('tabindex', '0')
      document.body.appendChild(el)
      el.focus()

      fireEvent.keyDown(el, { key: 'k', metaKey: true })

      expect(handlers.onOpenCommandK).toHaveBeenCalledOnce()
    })
  })
})
