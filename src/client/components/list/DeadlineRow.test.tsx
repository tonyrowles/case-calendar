// @vitest-environment jsdom
// Wave 0 stub — DeadlineRow component
// Plan 03-04 (Wave 3) converts these it.todo stubs to live it() tests.
//
// Requirements: VIEW-04 (row-level color shift for overdue/today deadlines)
// Design tokens: overdue = bg-red-50 + border-l-4 border-red-700 + text-red-700
//                today   = bg-amber-50 + border-l-4 border-amber-500 + text-amber-700
//                other   = bg-card, no left border
import { describe, it } from 'vitest'

describe('DeadlineRow — Wave 0 stubs (VIEW-04)', () => {
  it.todo('DR1: overdue row has bg-red-50 background + border-l-4 border-red-700 left edge + text-red-700 text color')
  it.todo('DR2: today row has bg-amber-50 background + border-l-4 border-amber-500 left edge + text-amber-700 text color')
  it.todo('DR3: default (future) row has bg-card background and no left border classes')
  it.todo('DR4: type color dot uses inline style={{ backgroundColor: color }} — no hardcoded hex (TYPE-06)')
})
