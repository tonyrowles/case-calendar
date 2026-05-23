// @vitest-environment jsdom
// Wave 0 stub — DateRangeSelect component
// Plan 03-03 (Wave 2) converts these it.todo stubs to live it() tests.
//
// Requirements: FILT-03 (date range preset — 5 options: Overdue, Today, This Week, This Month, All)
// Default = this-week; selecting default removes ?range= (default-elision)
import { describe, it } from 'vitest'

describe('DateRangeSelect — Wave 0 stubs (FILT-03)', () => {
  it.todo('DRS1: default this-week preset is shown when ?range= is absent from URL')
  it.todo('DRS2: selecting "overdue" preset writes ?range=overdue to URL')
  it.todo('DRS3: selecting "this-week" explicitly removes ?range= from URL (default-elision)')
  it.todo('DRS4: all 5 preset options are present in the select menu (overdue, today, this-week, this-month, all)')
})
