// @vitest-environment jsdom
// Wave 0 stub — CaseCombobox component
// Plan 03-03 (Wave 2) converts these it.todo stubs to live it() tests.
//
// Requirements: FILT-01 (case filter — single value combobox using shadcn Command inside Popover)
// Source: useQuery(['case-labels']) against GET /api/case-labels
import { describe, it } from 'vitest'

describe('CaseCombobox — Wave 0 stubs (FILT-01)', () => {
  it.todo('CC1: trigger label shows "Case" when no case is selected')
  it.todo('CC2: selecting a case label writes ?case=<label> to URL (URL-encoded)')
  it.todo('CC3: selecting the already-selected label removes ?case= from URL (deselect toggle)')
  it.todo('CC4: trigger label truncates to max-w-[180px] when a case label is active')
})
