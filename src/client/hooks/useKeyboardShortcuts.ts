import { useEffect } from 'react'

export interface ShortcutHandlers {
  onNewDeadline: () => void       // n
  onEditSelected: () => void      // e
  onDeleteSelected: () => void    // Delete
  onJumpToday: () => void         // t
  onMoveNext: () => void          // j
  onMovePrev: () => void          // k (when not chorded with meta/ctrl)
  onOpenHelp: () => void          // ?
  onOpenCommandK: () => void      // Cmd+K / Ctrl+K
}

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

export function useKeyboardShortcuts(handlers: ShortcutHandlers): void {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Cmd+K / Ctrl+K — fires even while typing (KBD-09 exception)
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handlers.onOpenCommandK()
        return
      }

      // No-typing guard (KBD-08): block all other shortcuts when a text input has focus
      // Note: isContentEditable may be undefined in some environments (JSDOM); fall back to
      // checking the contentEditable attribute string directly for cross-env correctness.
      const target = e.target as HTMLElement | null
      const isTyping =
        target != null &&
        (TYPING_TAGS.has(target.tagName) ||
          target.isContentEditable === true ||
          target.contentEditable === 'true')

      if (isTyping) return

      switch (e.key) {
        case 'n':
          e.preventDefault()
          handlers.onNewDeadline()
          break
        case 'e':
          e.preventDefault()
          handlers.onEditSelected()
          break
        case 'Delete':
          e.preventDefault()
          handlers.onDeleteSelected()
          break
        case 't':
          e.preventDefault()
          handlers.onJumpToday()
          break
        case 'j':
          e.preventDefault()
          handlers.onMoveNext()
          break
        case 'k':
          e.preventDefault()
          handlers.onMovePrev()
          break
        case '?':
          // T-05-02-03: preventDefault stops browser mid-page search activation (Shift+/)
          e.preventDefault()
          handlers.onOpenHelp()
          break
        // Esc is NOT intercepted — Radix overlays handle it themselves (KBD-06, RESEARCH Pitfall 8)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handlers])
}
