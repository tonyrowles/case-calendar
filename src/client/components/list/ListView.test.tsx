// @vitest-environment jsdom
// Wave 0 stub — ListView component
// Plan 03-04 (Wave 3) converts these it.todo stubs to live it() tests.
//
// Requirements: VIEW-03 (bucket ordering), VIEW-05 (single dataset feeds both views)
//
// NOTE: src/client/App.filters.test.tsx is NOT created in this plan (03-01).
// It is owned by Plan 03-04 (Wave 3) because it requires live FilterBar + ListView wiring
// to exercise the VIEW-05 single-dataset invariant. Per 03-VALIDATION.md row 03-04-02,
// App.filters.test.tsx lands when its target code lands.
import { describe, it } from 'vitest'

describe('ListView — Wave 0 stubs (VIEW-03, VIEW-05)', () => {
  it.todo('L1: bucket ordering — Overdue renders before Today, Today before ThisWeek, ThisWeek before NextWeek, NextWeek before Later')
  it.todo('L2: empty buckets hidden — if Today has zero deadlines, no "Today" header renders')
  it.todo('L3: renders a DeadlineRow for each deadline in the active bucket')
  it.todo('L4: all-empty state — when ALL buckets are empty after filtering, renders "No deadlines match your filters." copy')
})
