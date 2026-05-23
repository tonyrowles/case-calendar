// @vitest-environment jsdom
import { describe, it } from 'vitest'

describe('useKeyboardShortcuts', () => {
  it.todo("n fires onNewDeadline (KBD-01)")
  it.todo("e fires onEditSelected (KBD-02)")
  it.todo("Delete fires onDeleteSelected (KBD-03)")
  it.todo("t fires onJumpToday (KBD-04)")
  it.todo("j fires onMoveNext (KBD-05)")
  it.todo("k fires onMovePrev (KBD-05)")
  it.todo("Esc is NOT intercepted by hook — Radix handles it (KBD-06)")
  it.todo("? fires onOpenHelp (KBD-07)")
  it.todo("Cmd+K fires onOpenCommandK (KBD-09)")
  it.todo("Ctrl+K fires onOpenCommandK (KBD-09)")
  it.todo("no handler fires when active element is INPUT (KBD-08)")
  it.todo("no handler fires when active element is TEXTAREA (KBD-08)")
  it.todo("no handler fires when active element has contenteditable (KBD-08)")
  it.todo("Cmd+K still fires while typing in INPUT (KBD-09 exception)")
})
