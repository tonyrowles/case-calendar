// Wave 0 stub — classifyDeadline + groupByBucket + weekBoundaries
// Plan 03-02 (Wave 1) converts these it.todo stubs to live it() tests.
//
// Requirements: VIEW-03 (bucket ordering), VIEW-04 (color shift logic)
// DST coverage: 2026-03-08 (spring-forward), 2026-11-01 (fall-back)
// All math uses lexicographic ISO string comparison — no new Date(string) (SAFE-03).
import { describe, it } from 'vitest'

describe('classifyDeadline — Wave 0 stubs (VIEW-03, VIEW-04)', () => {
  it.todo('B1: DST spring-forward 2026-03-08 — classifyDeadline returns correct bucket when todayStr=2026-03-08')
  it.todo('B2: DST fall-back 2026-11-01 — classifyDeadline returns correct bucket when todayStr=2026-11-01')
  it.todo('B3: overdue — date strictly less than todayStr AND completedAt===null returns "overdue"')
  it.todo('B4: today — date === todayStr returns "today"')
  it.todo('B5: thisWeek — date in Sunday-Saturday window of current week returns "thisWeek"')
  it.todo('B6: nextWeek — date in following Sunday-Saturday window returns "nextWeek"')
  it.todo('B7: later — date after nextWeek end returns "later"')
})

describe('weekBoundaries — Wave 0 stubs (VIEW-03)', () => {
  it.todo('B8: weekBoundaries returns correct Sun-Sat thisWeekStart/thisWeekEnd/nextWeekStart/nextWeekEnd for a mid-week todayStr')
  it.todo('B9: weekBoundaries handles DST boundary dates correctly (pure string math)')
})

describe('groupByBucket — Wave 0 stubs (VIEW-03)', () => {
  it.todo('B10: groupByBucket sorts deadlines within each bucket ascending by date then createdAt')
  it.todo('B11: groupByBucket excludes deadlines with completedAt!==null from all buckets')
  it.todo('B12: groupByBucket returns empty arrays for buckets with no matching deadlines')
})
