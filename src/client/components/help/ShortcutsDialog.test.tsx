// @vitest-environment jsdom
import { describe, it } from 'vitest'

describe('ShortcutsDialog', () => {
  it.todo("renders all 9 keyboard shortcut rows (n, e, Delete, t, j, k, ?, Cmd/Ctrl+K, Esc) when open=true (KBD-07)")
  it.todo("does not render content when open=false")
  it.todo("closes via onOpenChange when Esc is pressed (Radix default behavior)")
})
