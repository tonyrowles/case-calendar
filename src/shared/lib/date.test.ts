import { describe, it, expect } from 'vitest'
import { parseLocalDate, toISODateString } from './date.js'

describe('parseLocalDate', () => {
  it('parses a valid date correctly', () => {
    const d = parseLocalDate('2026-06-15')
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2026)
    expect(d!.getMonth()).toBe(5)  // June = 5 (0-indexed)
    expect(d!.getDate()).toBe(15)
    // Local noon — not midnight to avoid DST issues
    expect(d!.getHours()).toBe(12)
  })

  it('returns null for an invalid calendar date (Feb 30)', () => {
    expect(parseLocalDate('2026-02-30')).toBeNull()
  })

  it('returns null for a malformed string', () => {
    expect(parseLocalDate('not-a-date')).toBeNull()
    expect(parseLocalDate('6/15/2026')).toBeNull()
    expect(parseLocalDate('2026-6-15')).toBeNull()
    expect(parseLocalDate('')).toBeNull()
  })

  it('handles DST boundary correctly (2026-03-08 in America/Los_Angeles)', () => {
    // This is the spring-forward date. Local noon is well outside the 2am transition.
    const d = parseLocalDate('2026-03-08')
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2026)
    expect(d!.getMonth()).toBe(2)  // March = 2
    expect(d!.getDate()).toBe(8)
  })

  it('returns null for invalid month (month 13)', () => {
    expect(parseLocalDate('2026-13-01')).toBeNull()
  })
})

describe('toISODateString', () => {
  it('round-trips with parseLocalDate', () => {
    const original = '2026-06-15'
    const date = parseLocalDate(original)
    expect(date).not.toBeNull()
    expect(toISODateString(date!)).toBe(original)
  })

  it('pads single-digit months and days', () => {
    const d = new Date(2026, 0, 5, 12, 0, 0)  // Jan 5
    expect(toISODateString(d)).toBe('2026-01-05')
  })
})
