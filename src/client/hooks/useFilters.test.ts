// Wave 0 stub — useFilters hook (URL ↔ Filters state)
// Plan 03-03 (Wave 2) converts these it.todo stubs to live it() tests.
//
// Requirements: FILT-04 (URL as single source of truth for filter state)
// Security: URL injection — ?type=abc clamped; ?range=garbage falls back to this-week
import { describe, it } from 'vitest'

describe('useFilters — Wave 0 stubs (FILT-04)', () => {
  it.todo('U1: reads URL params → returns typed Filters object (case, typeIds, range)')
  it.todo('U2: setter merges — calling setFilters with partial update merges into existing URL params')
  it.todo('U3: default-elision — range=this-week removes ?range= from URL (bare URL = default state)')
  it.todo('U4: clearAll — calling clearAll navigates to bare URL (no query params)')
  it.todo('U5: URL injection: ?type=abc (non-numeric) clamped — typeIds returns empty array')
  it.todo('U6: URL injection: ?range=garbage falls back to this-week range')
})
