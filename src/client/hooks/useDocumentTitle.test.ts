// Wave 0 stub — useDocumentTitle hook
// Plan 03-03 (Wave 2) converts these it.todo stubs to live it() tests.
//
// Requirements: VIEW-08 (browser tab title "Case Calendar (N due today)")
// Tab title count is NOT filter-aware — always all deadlines due today
import { describe, it } from 'vitest'

describe('useDocumentTitle — Wave 0 stubs (VIEW-08)', () => {
  it.todo('T1: N=3 due today → document.title is "Case Calendar (3 due today)"')
  it.todo('T2: N=0 due today → document.title is "Case Calendar" (no parens, no "(0 due today)")')
  it.todo('T3: deadlines with completedAt!==null are excluded from today count')
  it.todo('T4: count ignores filter state — title always reflects unfiltered all-deadlines-due-today count')
})
