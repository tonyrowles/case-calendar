import { useEffect, useRef } from 'react'

export interface ShortcutHandlers {
  onNewDeadline: () => void       // n
  onEditSelected: () => void      // e
  onDeleteSelected: () => void    // Delete
  onMoveNext: () => void          // j
  onMovePrev: () => void          // k (when not chorded with meta/ctrl)
  onOpenHelp: () => void          // ?
  onOpenCommandK: () => void      // Cmd+K / Ctrl+K
}

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

// Radix UI and cmdk use role attributes on non-input elements that should also
// suppress shortcuts. E.g. role="option" on SelectItem/CommandItem, role="listbox"
// on the open dropdown container, role="combobox" on the trigger button.
const TYPING_ROLES = new Set(['option', 'listbox', 'combobox', 'menu', 'menuitem', 'menuitemcheckbox'])

export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  // WR-02: use a stable ref so the keydown listener is added only once (on mount)
  // and removed only once (on unmount). Updating handlersRef.current on every render
  // means the listener always sees the latest closures without re-registering.
  const handlersRef = useRef(handlers)
  // Assign on every render (no dependency array) so handlersRef.current is always fresh.
  useEffect(() => {
    handlersRef.current = handlers
  })

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Cmd+K / Ctrl+K — fires even while typing (KBD-09 exception)
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handlersRef.current.onOpenCommandK()
        return
      }

      // No-typing guard (KBD-08): block all other shortcuts when a text input has focus
      // Note: isContentEditable may be undefined in some environments (JSDOM); fall back to
      // checking the contentEditable attribute string directly for cross-env correctness.
      // Also block when a Radix/cmdk interactive element has focus (role-based guard).
      const target = e.target as HTMLElement | null
      // getAttribute may not exist on non-element targets (e.g. window itself in tests)
      const role = typeof target?.getAttribute === 'function' ? target.getAttribute('role') : null
      const isTyping =
        target != null &&
        (TYPING_TAGS.has(target.tagName) ||
          target.isContentEditable === true ||
          target.contentEditable === 'true' ||
          (role != null && TYPING_ROLES.has(role)))

      if (isTyping) return

      switch (e.key) {
        case 'n':
          e.preventDefault()
          handlersRef.current.onNewDeadline()
          break
        case 'e':
          e.preventDefault()
          handlersRef.current.onEditSelected()
          break
        case 'Delete':
          e.preventDefault()
          handlersRef.current.onDeleteSelected()
          break
        case 'j':
          e.preventDefault()
          handlersRef.current.onMoveNext()
          break
        case 'k':
          e.preventDefault()
          handlersRef.current.onMovePrev()
          break
        case '?':
          // T-05-02-03: preventDefault stops browser mid-page search activation (Shift+/)
          e.preventDefault()
          handlersRef.current.onOpenHelp()
          break
        // Esc is NOT intercepted — Radix overlays handle it themselves (KBD-06, RESEARCH Pitfall 8)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, []) // stable — listener registered once, reads current handlers via handlersRef
}
