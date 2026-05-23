// @vitest-environment jsdom
import { describe, it } from 'vitest'

describe('App layout integration', () => {
  it.todo("at tier=three, both ListView and CalendarView render simultaneously (VIEW-06)")
  it.todo("at tier=two, only one of ListView/CalendarView renders (the one matching view toggle)")
  it.todo("at tier=one, layout matches Phase 4 (no ResizablePanelGroup)")
  it.todo("pressing n opens DeadlineForm with focus on caseLabel input (KBD-01 + integration)")
  it.todo("pressing j highlights the next deadline in the filtered list (KBD-05)")
  it.todo("Phase 1-4 regression: settings link still works")
})
