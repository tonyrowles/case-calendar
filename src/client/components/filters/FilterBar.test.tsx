// @vitest-environment jsdom
// Wave 0 stub — FilterBar component
// Plan 03-03 (Wave 2) converts these it.todo stubs to live it() tests.
//
// Requirements: FILT-05 (Clear button conditional render)
// Clear appears ONLY when at least one filter is non-default; clicking restores bare URL
import { describe, it } from 'vitest'

describe('FilterBar — Wave 0 stubs (FILT-05)', () => {
  it.todo('FB1: Clear button hidden when all filters are at defaults (bare URL / range=this-week only)')
  it.todo('FB2: Clear button visible when any filter is active (case set, or types set, or non-default range)')
  it.todo('FB3: clicking Clear navigates to bare URL (removes all query params)')
})
