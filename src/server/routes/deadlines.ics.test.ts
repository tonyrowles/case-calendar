import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { app } from '../index.js'
import { sqlite } from '../db.js'

const fixturePath = resolve(process.cwd(), 'tests/fixtures/sample-calendar.ics')

function cleanTables(): void {
  sqlite.exec('DELETE FROM deadlines')
  sqlite.exec('DELETE FROM deadline_types')
}

function seedType(id: number, name: string, color: string): void {
  sqlite
    .prepare('INSERT OR IGNORE INTO deadline_types (id, name, color) VALUES (?, ?, ?)')
    .run(id, name, color) // allow-hex: test fixture
}

function seedDeadline(
  date: string,
  caseLabel: string,
  typeId: number,
  opts?: { completedAt?: string; description?: string }
): number {
  const row = sqlite
    .prepare(
      'INSERT INTO deadlines (date, caseLabel, typeId, completedAt, description) VALUES (?, ?, ?, ?, ?) RETURNING id'
    )
    .get(date, caseLabel, typeId, opts?.completedAt ?? null, opts?.description ?? null) as { id: number }
  return row.id
}

describe('GET /api/deadlines.ics', () => {
  beforeEach(() => {
    cleanTables()
    seedType(1, 'Filing', '#1D4ED8') // allow-hex: test fixture
  })

  it('Test 1 (200 + headers): status 200, text/calendar content-type, VCALENDAR body', async () => {
    seedDeadline('2026-06-15', 'Smith v. Jones', 1)
    const res = await app.request('/api/deadlines.ics')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/calendar')
    expect(res.headers.get('content-disposition')).toContain('filename="case-calendar.ics"')
    const body = await res.text()
    expect(body).toContain('BEGIN:VCALENDAR')
    expect(body).toContain('END:VCALENDAR')
    expect(body).toContain('VERSION:2.0')
    expect(body).toContain('Case Calendar')
  })

  it('Test 2 (DTSTART;VALUE=DATE all-day shape): date 2026-06-15 produces DTSTART:20260615 / DTEND:20260616', async () => {
    seedDeadline('2026-06-15', 'Smith v. Jones', 1)
    const res = await app.request('/api/deadlines.ics')
    const body = await res.text()
    expect(body).toMatch(/DTSTART;VALUE=DATE:20260615/)
    expect(body).toMatch(/DTEND;VALUE=DATE:20260616/)
  })

  it('Test 3 (UID stability): deadline id produces correct UID', async () => {
    // Insert with explicit id
    sqlite.prepare('INSERT INTO deadline_types (id, name, color) VALUES (?, ?, ?)').run(7, 'Hearing', '#10B981') // allow-hex: test fixture
    const id = seedDeadline('2026-07-01', 'Test Case', 7)
    const res = await app.request('/api/deadlines.ics')
    const body = await res.text()
    expect(body).toContain(`UID:${id}@case-calendar.local`)
  })

  it('Test 4 (SUMMARY shape): type "Filing", case "Smith v. Jones" -> em-dash SUMMARY', async () => {
    seedDeadline('2026-06-15', 'Smith v. Jones', 1)
    const res = await app.request('/api/deadlines.ics')
    const body = await res.text()
    expect(body).toContain('SUMMARY:Smith v. Jones — Filing')
  })

  it('Test 5 (DESCRIPTION conditional): non-empty description included, empty excluded', async () => {
    seedDeadline('2026-06-01', 'Case A', 1, { description: '' })
    seedDeadline('2026-06-02', 'Case B', 1, { description: 'Motion to compel' })
    const res = await app.request('/api/deadlines.ics')
    const body = await res.text()
    expect(body).toContain('DESCRIPTION:Motion to compel')
    // Should appear exactly once
    const matches = body.match(/DESCRIPTION:/g)
    expect(matches?.length).toBe(1)
  })

  it('Test 6 (status default): excludes completed deadlines by default', async () => {
    seedDeadline('2026-06-01', 'Active Case', 1)
    seedDeadline('2026-06-02', 'Done Case', 1, { completedAt: '2026-05-01 10:00:00' })
    const res = await app.request('/api/deadlines.ics')
    const body = await res.text()
    const count = (body.match(/BEGIN:VEVENT/g) ?? []).length
    expect(count).toBe(1)
  })

  it('Test 7 (?showCompleted=1 opt-in): includes completed with STATUS:CONFIRMED', async () => {
    seedDeadline('2026-06-01', 'Active Case', 1)
    seedDeadline('2026-06-02', 'Done Case', 1, { completedAt: '2026-05-01 10:00:00' })
    const res = await app.request('/api/deadlines.ics?showCompleted=1')
    const body = await res.text()
    const count = (body.match(/BEGIN:VEVENT/g) ?? []).length
    expect(count).toBe(2)
    // STATUS must never be CANCELLED (calendar clients hide cancelled events)
    expect(body).not.toContain('STATUS:CANCELLED')
    expect(body).toContain('STATUS:CONFIRMED')
  })

  it('Test 8 (?case= filter): filters to exact-match case label', async () => {
    seedDeadline('2026-06-01', 'Smith v. Jones', 1)
    seedDeadline('2026-06-02', 'Jones v. Smith', 1)
    const res = await app.request('/api/deadlines.ics?case=Smith%20v.%20Jones')
    const body = await res.text()
    const count = (body.match(/BEGIN:VEVENT/g) ?? []).length
    expect(count).toBe(1)
    expect(body).toContain('Smith v. Jones — Filing')
  })

  it('Test 9 (?type=csv filter): filters by typeId CSV; invalid values ignored', async () => {
    seedType(2, 'Hearing', '#10B981') // allow-hex: test fixture
    seedDeadline('2026-06-01', 'Smith v. Jones', 1)
    seedDeadline('2026-06-02', 'Jones v. Smith', 2)

    // Single type filter
    const res1 = await app.request('/api/deadlines.ics?type=1')
    const body1 = await res1.text()
    expect((body1.match(/BEGIN:VEVENT/g) ?? []).length).toBe(1)
    expect(body1).toContain('Smith v. Jones — Filing')

    // Both types
    const res2 = await app.request('/api/deadlines.ics?type=1,2')
    const body2 = await res2.text()
    expect((body2.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2)

    // Invalid values ignored — returns all
    const res3 = await app.request('/api/deadlines.ics?type=abc,xyz')
    const body3 = await res3.text()
    expect((body3.match(/BEGIN:VEVENT/g) ?? []).length).toBe(2)
  })

  it('Test 10 (?type cap): at most 50 typeIds used from a long CSV', async () => {
    // Seed 51 types and 51 deadlines
    for (let i = 2; i <= 51; i++) {
      seedType(i, `Type${i}`, '#000000') // allow-hex: test fixture
    }
    for (let i = 1; i <= 51; i++) {
      seedDeadline(`2026-06-${String(i).padStart(2, '0')}`, `Case ${i}`, i)
    }
    // Build CSV with 51 typeIds
    const csvIds = Array.from({ length: 51 }, (_, k) => k + 1).join(',')
    const res = await app.request(`/api/deadlines.ics?type=${csvIds}`)
    const body = await res.text()
    const count = (body.match(/BEGIN:VEVENT/g) ?? []).length
    expect(count).toBeLessThanOrEqual(50)
  })

  it('Test 11 (ETag round-trip): first GET returns ETag; second GET with If-None-Match returns 304', async () => {
    seedDeadline('2026-06-15', 'Smith v. Jones', 1)
    const res1 = await app.request('/api/deadlines.ics')
    const etag = res1.headers.get('etag')
    expect(etag).not.toBeNull()

    const res2 = await app.request('/api/deadlines.ics', {
      headers: { 'If-None-Match': etag! },
    })
    expect(res2.status).toBe(304)
    const body2 = await res2.text()
    expect(body2).toBe('')
  })

  it('Test 12 (snapshot): masked body matches sample-calendar.ics fixture', async () => {
    // Deterministic seed: id controlled via explicit insert
    sqlite.exec('DELETE FROM deadlines')
    const row = sqlite
      .prepare(
        'INSERT INTO deadlines (date, caseLabel, typeId, description) VALUES (?, ?, ?, ?) RETURNING id'
      )
      .get('2026-06-15', 'Smith v. Jones', 1, '') as { id: number }
    expect(row.id).toBeGreaterThan(0)

    const res = await app.request('/api/deadlines.ics')
    const rawBody = await res.text()

    // Mask volatile timestamp lines and auto-increment UID before comparison.
    // UID value is already tested for stability in Test 3.
    // Auto-increment does not reset on DELETE, so we normalize the UID to a
    // placeholder to keep the fixture time-stable across test runs.
    const maskedBody = rawBody
      .replace(/^(DTSTAMP|LAST-MODIFIED|CREATED):.*$/gm, '$1:MASKED')
      .replace(/^UID:.*@case-calendar\.local$/gm, 'UID:MASKED@case-calendar.local')
    const fixture = readFileSync(fixturePath, 'utf8')
    // Also normalize fixture UID for comparison
    const maskedFixture = fixture.replace(
      /^UID:.*@case-calendar\.local$/gm,
      'UID:MASKED@case-calendar.local'
    )

    expect(maskedBody).toBe(maskedFixture)
  })

  it('Test 13 (long description folding): 200-char description produces RFC 5545 line fold', async () => {
    const longDesc = 'A'.repeat(200)
    seedDeadline('2026-06-15', 'Smith v. Jones', 1, { description: longDesc })
    const res = await app.request('/api/deadlines.ics')
    const body = await res.text()
    // RFC 5545 §3.1: long lines folded at 75 octets with CRLF followed by a linear white space
    // character (either SPACE or HTAB). The ics package uses CRLF+TAB.
    expect(body).toMatch(/\r\n[\t ]/)

  })
})
