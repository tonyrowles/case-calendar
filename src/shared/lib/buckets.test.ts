// Wave 1 — converted from it.todo stubs (Plan 03-01) to live tests (Plan 03-02).
//
// Requirements: VIEW-03 (bucket ordering), VIEW-04 (color shift logic)
// DST coverage: 2026-03-08 (spring-forward), 2026-11-01 (fall-back)
// All math uses lexicographic ISO string comparison — no new Date(string) (SAFE-03).
import { describe, it, expect } from 'vitest'
import { classifyDeadline, weekBoundaries, groupByBucket } from './buckets.js'

// ---------------------------------------------------------------------------
// Canonical fixture date: Thursday 2026-05-21
// weekBoundaries('2026-05-21') => thisWeekStart='2026-05-17' (Sun), thisWeekEnd='2026-05-23' (Sat)
//                                  nextWeekStart='2026-05-24' (Sun), nextWeekEnd='2026-05-30' (Sat)
// ---------------------------------------------------------------------------
const TODAY = '2026-05-21'

describe('classifyDeadline — VIEW-03, VIEW-04', () => {
  it('B1: DST spring-forward 2026-03-08 — date before today returns overdue', () => {
    // 2026-03-08 is the spring-forward day (clocks spring ahead at 2 AM local).
    // A deadline on 2026-03-07 viewed on 2026-03-08 must still classify as 'overdue'.
    // Pure ISO string comparison avoids any DST off-by-one.
    expect(
      classifyDeadline({ date: '2026-03-07', completedAt: null }, '2026-03-08')
    ).toBe('overdue')
  })

  it('B2: DST fall-back 2026-11-01 — date before today returns overdue', () => {
    // 2026-11-01 is the fall-back day (clocks fall back at 2 AM local).
    // A deadline on 2026-10-31 viewed on 2026-11-01 must still classify as 'overdue'.
    expect(
      classifyDeadline({ date: '2026-10-31', completedAt: null }, '2026-11-01')
    ).toBe('overdue')
  })

  it('B3: overdue — date strictly less than todayStr AND completedAt===null returns "overdue"', () => {
    // Overdue requires BOTH conditions: past date AND not completed.
    expect(
      classifyDeadline({ date: '2026-05-20', completedAt: null }, TODAY)
    ).toBe('overdue')
    // Completed deadline on a past date does NOT return 'overdue' (falls through to 'today' etc.)
    // (groupByBucket excludes completed entries; direct callers see the date-based bucket)
    const completedPast = classifyDeadline({ date: '2026-05-20', completedAt: '2026-05-20T12:00:00' }, TODAY)
    expect(completedPast).not.toBe('overdue')
  })

  it('B4: today — date === todayStr returns "today"', () => {
    expect(
      classifyDeadline({ date: TODAY, completedAt: null }, TODAY)
    ).toBe('today')
    // Even a completed today-deadline classifies as 'today' (groupByBucket filters upstream)
    expect(
      classifyDeadline({ date: TODAY, completedAt: '2026-05-21T09:00:00' }, TODAY)
    ).toBe('today')
  })

  it('B5: thisWeek — date in (todayStr, thisWeekEnd] returns "thisWeek"', () => {
    // The day after today (Fri 2026-05-22) is still this week
    expect(
      classifyDeadline({ date: '2026-05-22', completedAt: null }, TODAY)
    ).toBe('thisWeek')
    // Saturday end of this week (2026-05-23) is still thisWeek
    expect(
      classifyDeadline({ date: '2026-05-23', completedAt: null }, TODAY)
    ).toBe('thisWeek')
    // Today itself is 'today', NOT 'thisWeek' (today bucket wins)
    expect(
      classifyDeadline({ date: TODAY, completedAt: null }, TODAY)
    ).toBe('today')
  })

  it('B6: nextWeek — date in [nextWeekStart, nextWeekEnd] returns "nextWeek"', () => {
    // nextWeekStart = 2026-05-24 (Sun)
    expect(
      classifyDeadline({ date: '2026-05-24', completedAt: null }, TODAY)
    ).toBe('nextWeek')
    // nextWeekEnd = 2026-05-30 (Sat)
    expect(
      classifyDeadline({ date: '2026-05-30', completedAt: null }, TODAY)
    ).toBe('nextWeek')
    // The day after next week ends is 'later'
    expect(
      classifyDeadline({ date: '2026-05-31', completedAt: null }, TODAY)
    ).toBe('later')
  })

  it('B7: later — date after nextWeek end returns "later"', () => {
    expect(
      classifyDeadline({ date: '2026-06-15', completedAt: null }, TODAY)
    ).toBe('later')
    expect(
      classifyDeadline({ date: '2027-01-01', completedAt: null }, TODAY)
    ).toBe('later')
  })
})

describe('weekBoundaries — VIEW-03', () => {
  it('B8: weekBoundaries returns correct Sun-Sat thisWeekStart/thisWeekEnd/nextWeekStart/nextWeekEnd for a mid-week todayStr', () => {
    // Thursday 2026-05-21 (dow=4): thisWeekStart = 2026-05-17 (Sun), thisWeekEnd = 2026-05-23 (Sat)
    // nextWeekStart = 2026-05-24 (Sun), nextWeekEnd = 2026-05-30 (Sat)
    const bounds = weekBoundaries('2026-05-21')
    expect(bounds.thisWeekStart).toBe('2026-05-17')
    expect(bounds.thisWeekEnd).toBe('2026-05-23')
    expect(bounds.nextWeekStart).toBe('2026-05-24')
    expect(bounds.nextWeekEnd).toBe('2026-05-30')
  })

  it('B9: weekBoundaries handles DST boundary dates correctly and Sunday todayStr is its own week start', () => {
    // Sunday 2026-05-17 (dow=0): thisWeekStart should be 2026-05-17 itself
    const sundayBounds = weekBoundaries('2026-05-17')
    expect(sundayBounds.thisWeekStart).toBe('2026-05-17')
    expect(sundayBounds.thisWeekEnd).toBe('2026-05-23')
    expect(sundayBounds.nextWeekStart).toBe('2026-05-24')
    expect(sundayBounds.nextWeekEnd).toBe('2026-05-30')

    // DST spring-forward: 2026-03-08 (Sunday, dow=0) — week starts on itself
    const dstSpringBounds = weekBoundaries('2026-03-08')
    expect(dstSpringBounds.thisWeekStart).toBe('2026-03-08')
    expect(dstSpringBounds.thisWeekEnd).toBe('2026-03-14')
    expect(dstSpringBounds.nextWeekStart).toBe('2026-03-15')
    expect(dstSpringBounds.nextWeekEnd).toBe('2026-03-21')

    // DST fall-back: 2026-11-01 (Sunday, dow=0)
    const dstFallBounds = weekBoundaries('2026-11-01')
    expect(dstFallBounds.thisWeekStart).toBe('2026-11-01')
    expect(dstFallBounds.thisWeekEnd).toBe('2026-11-07')
  })
})

describe('groupByBucket — VIEW-03', () => {
  it('B10: groupByBucket sorts deadlines within each bucket ascending by date then createdAt', () => {
    const deadlines = [
      // Two deadlines on the same 'thisWeek' date — different createdAt
      { date: '2026-05-22', completedAt: null, createdAt: '2026-05-01T10:00:00', id: 2 },
      { date: '2026-05-22', completedAt: null, createdAt: '2026-05-01T09:00:00', id: 1 },
      // Earlier date in thisWeek
      { date: '2026-05-23', completedAt: null, createdAt: '2026-04-01T08:00:00', id: 3 },
    ]
    const result = groupByBucket(deadlines, TODAY)
    // 2026-05-22 comes before 2026-05-23; within same date, earlier createdAt first
    expect(result.thisWeek[0].id).toBe(1)   // 2026-05-22 + earlier createdAt
    expect(result.thisWeek[1].id).toBe(2)   // 2026-05-22 + later createdAt
    expect(result.thisWeek[2].id).toBe(3)   // 2026-05-23
  })

  it('B11: groupByBucket excludes deadlines with completedAt!==null from all buckets', () => {
    const deadlines = [
      // Completed deadline on a future date — should be excluded
      { date: '2026-05-22', completedAt: '2026-05-21T10:00:00', createdAt: '2026-05-01T00:00:00', id: 1 },
      // Completed overdue deadline — should be excluded
      { date: '2026-05-10', completedAt: '2026-05-11T00:00:00', createdAt: '2026-04-01T00:00:00', id: 2 },
      // Active deadline — should appear
      { date: '2026-05-22', completedAt: null, createdAt: '2026-05-01T00:00:00', id: 3 },
    ]
    const result = groupByBucket(deadlines, TODAY)
    const allBucketIds = [
      ...result.overdue,
      ...result.today,
      ...result.thisWeek,
      ...result.nextWeek,
      ...result.later,
    ].map(d => d.id)
    // Completed deadlines (id=1, id=2) must not appear in any bucket
    expect(allBucketIds).not.toContain(1)
    expect(allBucketIds).not.toContain(2)
    // Active deadline (id=3) must appear
    expect(allBucketIds).toContain(3)
  })

  it('B12: groupByBucket returns empty arrays for buckets with no matching deadlines', () => {
    // Only one deadline, in 'later'
    const deadlines = [
      { date: '2026-12-31', completedAt: null, createdAt: '2026-05-01T00:00:00', id: 1 },
    ]
    const result = groupByBucket(deadlines, TODAY)
    expect(result.overdue).toHaveLength(0)
    expect(result.today).toHaveLength(0)
    expect(result.thisWeek).toHaveLength(0)
    expect(result.nextWeek).toHaveLength(0)
    expect(result.later).toHaveLength(1)
  })
})
