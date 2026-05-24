// SAFE-03: Pure function tests — no mocks, no DB, no SMTP.
import { describe, it, expect } from 'vitest'
import {
  filterDigest,
  buildSubject,
  renderPlainText,
  renderHTML,
  type DigestDeadline,
  type DigestData,
} from './email-render.js'

// Shared constant: today used across all tests
const TODAY = '2026-05-24'

// Factory: create a DigestDeadline with defaults overridden by fields
function mk(fields: Partial<DigestDeadline> & { date: string; caseLabel: string }): DigestDeadline {
  return {
    id: 1,
    date: fields.date,
    caseLabel: fields.caseLabel,
    typeName: fields.typeName ?? 'Filing',
    typeColor: fields.typeColor ?? '#1D4ED8',
    description: fields.description ?? null,
    completedAt: fields.completedAt ?? null,
    ...fields,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// filterDigest
// ─────────────────────────────────────────────────────────────────────────────

describe('filterDigest', () => {
  it('excludes completed deadlines', () => {
    const deadlines = [
      mk({ id: 1, date: TODAY, caseLabel: 'Open Case', completedAt: null }),
      mk({ id: 2, date: TODAY, caseLabel: 'Done Case', completedAt: '2026-05-20T10:00:00Z' }),
    ]
    const result = filterDigest(deadlines, TODAY)
    const allDeadlines = [
      ...result.overdue,
      ...result.grouped.flatMap(g => g.deadlines),
    ]
    expect(allDeadlines.map(d => d.caseLabel)).toEqual(['Open Case'])
  })

  it('classifies overdue deadlines (date < today, completedAt null) in DESC order, capped at 30', () => {
    // Build 35 overdue deadlines with different dates
    const overdueDates: DigestDeadline[] = []
    for (let i = 1; i <= 35; i++) {
      const dayStr = String(i).padStart(2, '0')
      overdueDates.push(mk({ id: i, date: `2026-04-${dayStr}`, caseLabel: `Case ${i}`, completedAt: null }))
    }
    const result = filterDigest(overdueDates, TODAY)
    // Should be capped at 30
    expect(result.overdue.length).toBe(30)
    // Most recent first (DESC) — 2026-04-35 doesn't exist but let's check ordering with valid dates
    // The highest dates come first
    const dates = result.overdue.map(d => d.date)
    for (let i = 1; i < dates.length; i++) {
      expect(dates[i] <= dates[i - 1]).toBe(true)
    }
    // grouped should be empty
    expect(result.grouped).toEqual([])
  })

  it('today is included in grouped (not overdue)', () => {
    const deadlines = [mk({ id: 1, date: TODAY, caseLabel: 'Today Case' })]
    const result = filterDigest(deadlines, TODAY)
    expect(result.overdue).toEqual([])
    expect(result.grouped).toHaveLength(1)
    expect(result.grouped[0].date).toBe(TODAY)
  })

  it('includes 14-day window boundary: today and today+14', () => {
    const windowEnd = '2026-06-07' // TODAY + 14 days
    const deadlines = [
      mk({ id: 1, date: TODAY, caseLabel: 'Start Case' }),
      mk({ id: 2, date: windowEnd, caseLabel: 'End Case' }),
      mk({ id: 3, date: '2026-06-08', caseLabel: 'Outside Case' }), // day 15 — excluded
    ]
    const result = filterDigest(deadlines, TODAY)
    expect(result.overdue).toEqual([])
    const allInWindow = result.grouped.flatMap(g => g.deadlines)
    const labels = allInWindow.map(d => d.caseLabel)
    expect(labels).toContain('Start Case')
    expect(labels).toContain('End Case')
    expect(labels).not.toContain('Outside Case')
  })

  it('groups by date ASC and sorts by caseLabel ASC within date', () => {
    const deadlines = [
      mk({ id: 1, date: '2026-05-25', caseLabel: 'Zephyr LLC' }),
      mk({ id: 2, date: '2026-05-25', caseLabel: 'Anderson Estate' }),
      mk({ id: 3, date: '2026-05-26', caseLabel: 'Brown Litigation' }),
      mk({ id: 4, date: '2026-05-25', caseLabel: 'Morris v. City' }),
    ]
    const result = filterDigest(deadlines, TODAY)
    expect(result.grouped).toHaveLength(2)
    // Dates ascending
    expect(result.grouped[0].date).toBe('2026-05-25')
    expect(result.grouped[1].date).toBe('2026-05-26')
    // Within 2026-05-25: caseLabel ASC
    expect(result.grouped[0].deadlines.map(d => d.caseLabel)).toEqual([
      'Anderson Estate',
      'Morris v. City',
      'Zephyr LLC',
    ])
  })

  it('returns empty result when input is empty', () => {
    const result = filterDigest([], TODAY)
    expect(result).toEqual({ overdue: [], grouped: [] })
  })

  it('returns empty result when all deadlines are outside window and none overdue', () => {
    const deadlines = [
      mk({ id: 1, date: '2026-06-08', caseLabel: 'Far Future' }),
    ]
    const result = filterDigest(deadlines, TODAY)
    expect(result).toEqual({ overdue: [], grouped: [] })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// buildSubject
// ─────────────────────────────────────────────────────────────────────────────

describe('buildSubject', () => {
  it('returns All clear when count is 0', () => {
    const data: DigestData = { overdue: [], grouped: [] }
    expect(buildSubject(data)).toBe('Case Calendar digest — All clear in next 14 days')
  })

  it('returns singular when count is 1', () => {
    const data: DigestData = {
      overdue: [],
      grouped: [{ date: TODAY, deadlines: [mk({ date: TODAY, caseLabel: 'X' })] }],
    }
    expect(buildSubject(data)).toBe('Case Calendar digest — 1 deadline in next 14 days')
  })

  it('returns plural when count is 2', () => {
    const data: DigestData = {
      overdue: [mk({ date: '2026-05-23', caseLabel: 'Old' })],
      grouped: [{ date: TODAY, deadlines: [mk({ date: TODAY, caseLabel: 'New' })] }],
    }
    expect(buildSubject(data)).toBe('Case Calendar digest — 2 deadlines in next 14 days')
  })

  it('returns plural when count is 15', () => {
    const many = Array.from({ length: 14 }, (_, i) =>
      mk({ date: TODAY, caseLabel: `Case ${i}` })
    )
    const data: DigestData = {
      overdue: [mk({ date: '2026-05-23', caseLabel: 'Old' })],
      grouped: [{ date: TODAY, deadlines: many }],
    }
    expect(buildSubject(data)).toBe('Case Calendar digest — 15 deadlines in next 14 days')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// renderPlainText
// ─────────────────────────────────────────────────────────────────────────────

describe('renderPlainText', () => {
  it('returns single no-deadlines line when data is empty', () => {
    expect(renderPlainText({ overdue: [], grouped: [] })).toBe(
      'No deadlines in the next 14 days.'
    )
  })

  it('matches inline snapshot for one overdue + two date groups', () => {
    const data: DigestData = {
      overdue: [
        mk({ id: 10, date: '2026-05-22', caseLabel: 'Overdue Case', typeName: 'Hearing', description: 'urgent' }),
      ],
      grouped: [
        {
          date: '2026-05-25',
          deadlines: [
            mk({ id: 11, date: '2026-05-25', caseLabel: 'Smith v. Jones', typeName: 'Filing', description: 'Motion to compel' }),
          ],
        },
        {
          date: '2026-05-26',
          deadlines: [
            mk({ id: 12, date: '2026-05-26', caseLabel: 'Brown Litigation', typeName: 'Deposition', description: null }),
          ],
        },
      ],
    }
    expect(renderPlainText(data)).toMatchInlineSnapshot(`
      "=== OVERDUE ===
      [2026-05-22] Overdue Case — Hearing — urgent

      === Monday, May 25 ===
      [2026-05-25] Smith v. Jones — Filing — Motion to compel

      === Tuesday, May 26 ===
      [2026-05-26] Brown Litigation — Deposition"
    `)
  })

  it('omits description separator when description is empty', () => {
    const data: DigestData = {
      overdue: [],
      grouped: [
        {
          date: '2026-05-25',
          deadlines: [
            mk({ id: 1, date: '2026-05-25', caseLabel: 'No Desc', typeName: 'SOL', description: '' }),
          ],
        },
      ],
    }
    const result = renderPlainText(data)
    // Should NOT have trailing em-dash
    expect(result).not.toContain('SOL —')
    expect(result).toContain('[2026-05-25] No Desc — SOL')
  })

  it('includes description when non-empty', () => {
    const data: DigestData = {
      overdue: [],
      grouped: [
        {
          date: '2026-05-25',
          deadlines: [
            mk({ id: 1, date: '2026-05-25', caseLabel: 'With Desc', typeName: 'Filing', description: 'Answer due' }),
          ],
        },
      ],
    }
    const result = renderPlainText(data)
    expect(result).toContain('[2026-05-25] With Desc — Filing — Answer due')
  })

  it('date header uses EEEE, MMMM d format (weekday + month day)', () => {
    const data: DigestData = {
      overdue: [],
      grouped: [
        {
          date: '2026-05-25',
          deadlines: [mk({ date: '2026-05-25', caseLabel: 'A' })],
        },
      ],
    }
    const result = renderPlainText(data)
    // 2026-05-25 is a Monday
    expect(result).toContain('=== Monday, May 25 ===')
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// renderHTML
// ─────────────────────────────────────────────────────────────────────────────

describe('renderHTML', () => {
  it('contains outer table with width:600px exactly once', () => {
    const data: DigestData = {
      overdue: [],
      grouped: [
        {
          date: TODAY,
          deadlines: [mk({ date: TODAY, caseLabel: 'A' })],
        },
      ],
    }
    const html = renderHTML(data)
    const matches = html.match(/width:600px/g)
    expect(matches).toBeTruthy()
    expect(matches!.length).toBe(1)
  })

  it('has no <style> tag', () => {
    const data: DigestData = { overdue: [], grouped: [] }
    const html = renderHTML(data)
    expect(html).not.toContain('<style')
  })

  it('has border="0" cellpadding="0" cellspacing="0" attributes', () => {
    const data: DigestData = { overdue: [], grouped: [] }
    const html = renderHTML(data)
    expect(html).toContain('border="0"')
    expect(html).toContain('cellpadding="0"')
    expect(html).toContain('cellspacing="0"')
  })

  it('escapes & < > " in caseLabel', () => {
    const data: DigestData = {
      overdue: [],
      grouped: [
        {
          date: TODAY,
          deadlines: [
            mk({ date: TODAY, caseLabel: 'Smith & <Jones> "Estate"', typeName: 'Filing' }),
          ],
        },
      ],
    }
    const html = renderHTML(data)
    expect(html).toContain('Smith &amp; &lt;Jones&gt; &quot;Estate&quot;')
    expect(html).not.toContain('Smith & ')
    expect(html).not.toContain('<Jones>')
  })

  it('escapes typeName', () => {
    const data: DigestData = {
      overdue: [],
      grouped: [
        {
          date: TODAY,
          deadlines: [
            mk({ date: TODAY, caseLabel: 'X', typeName: '<Script/>', typeColor: '#ff0000' }),
          ],
        },
      ],
    }
    const html = renderHTML(data)
    expect(html).toContain('&lt;Script/&gt;')
    expect(html).not.toContain('<Script/>')
  })

  it('escapes description', () => {
    const data: DigestData = {
      overdue: [],
      grouped: [
        {
          date: TODAY,
          deadlines: [
            mk({ date: TODAY, caseLabel: 'X', typeName: 'Filing', description: 'See <exhibit> A & B' }),
          ],
        },
      ],
    }
    const html = renderHTML(data)
    expect(html).toContain('See &lt;exhibit&gt; A &amp; B')
  })

  it('includes typeColor in badge background style', () => {
    const data: DigestData = {
      overdue: [],
      grouped: [
        {
          date: TODAY,
          deadlines: [
            mk({ date: TODAY, caseLabel: 'A', typeName: 'Hearing', typeColor: '#dc2626' }),
          ],
        },
      ],
    }
    const html = renderHTML(data)
    expect(html).toContain('background:#dc2626')
  })

  it('returns "No deadlines" message for empty data', () => {
    const html = renderHTML({ overdue: [], grouped: [] })
    expect(html).toContain('No deadlines in the next 14 days.')
  })

  it('includes red OVERDUE section bar when overdue deadlines exist', () => {
    const data: DigestData = {
      overdue: [mk({ id: 1, date: '2026-05-22', caseLabel: 'Old Case' })],
      grouped: [],
    }
    const html = renderHTML(data)
    expect(html).toContain('OVERDUE')
    expect(html).toContain('#dc2626')
  })
})
