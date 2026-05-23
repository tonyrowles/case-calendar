// @vitest-environment jsdom
import { describe, it } from 'vitest'

describe('PaneLayout', () => {
  it.todo("renders three panels when tier=three (VIEW-06)")
  it.todo("renders two panels when tier=two")
  it.todo("renders one panel (single column, no ResizablePanelGroup) when tier=one (VIEW-07)")
  it.todo("view toggle is hidden at tier=three")
  it.todo("view toggle is visible at tier=two")
  it.todo("view toggle is visible at tier=one")
  it.todo("passes autoSaveId='cc-pane-sizes' to ResizablePanelGroup at tier=three")
})
