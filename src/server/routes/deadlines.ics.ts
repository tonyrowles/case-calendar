import { etag } from 'hono/etag'
import { createEvents } from 'ics'
import type { EventAttributes } from 'ics'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '../db.js'
import { deadlines } from '../../../drizzle/schema.js'
import { getAllDeadlineTypes } from '../queries.js'
import { logger } from '../logger.js'
import type { Hono } from 'hono'
import type { AppVariables } from '../middleware/user-context.js'

/**
 * Convert a SQLite CURRENT_TIMESTAMP string ('YYYY-MM-DD HH:MM:SS', UTC)
 * to unix milliseconds for the `ics` package's `lastModified`/`created` fields.
 * RESEARCH Finding 4: passing an array to ics treats it as local time (wrong);
 * unix milliseconds are always UTC.
 */
function sqliteTimestampToUnixMs(ts: string): number {
  return new Date(ts.replace(' ', 'T') + 'Z').getTime()
}

/**
 * Register GET /deadlines.ics on the existing deadlinesRouter.
 * Route mount is done here to keep route semantics identical to the router's mount.
 * Per CONTEXT.md D-02: path is /deadlines.ics (relative to /api mount in index.ts).
 * Per RESEARCH Pitfall 5: etag() applied per-route, NEVER globally.
 * Per SAFE-07: port 3747 loopback-only — webcal URL is hardcoded in the client component.
 */
export function registerIcsRoute(router: Hono<{ Variables: AppVariables }>): void {
  router.get('/deadlines.ics', etag(), (c) => {
    try {
      // Parse query params (all return string | undefined from Hono)
      const caseLabel = c.req.query('case')
      const typeParam = c.req.query('type') ?? ''
      const showCompleted = c.req.query('showCompleted') === '1'

      // Parse typeIds with safety (RESEARCH Pitfall 8):
      // Non-integers are dropped; slice caps at 50 (THREAT T-7-03)
      const typeIds = typeParam
        ? typeParam
            .split(',')
            .map((s) => parseInt(s, 10))
            .filter((n) => Number.isInteger(n) && n > 0)
            .slice(0, 50)
        : []

      // Build Drizzle WHERE conditions (THREAT T-7-02: parameterized operators)
      const conditions: ReturnType<typeof eq>[] = []
      if (caseLabel) conditions.push(eq(deadlines.caseLabel, caseLabel))
      if (typeIds.length) conditions.push(inArray(deadlines.typeId, typeIds))
      if (!showCompleted) conditions.push(isNull(deadlines.completedAt))

      // Query deadlines with filters applied; order by date ascending
      const rows = db
        .select()
        .from(deadlines)
        .where(conditions.length ? and(...conditions) : undefined)
        .orderBy(deadlines.date)
        .all()

      // Build type name map for SUMMARY field
      const typeMap = new Map(getAllDeadlineTypes().map((t) => [t.id, t.name]))

      // Map rows to ics EventAttributes
      const events: EventAttributes[] = rows.map((d) => {
        // DTSTART: all-day, pass [year, month, day] array
        const start = d.date.split('-').map(Number) as [number, number, number]

        // DTEND: next day per RFC 5545 half-open interval convention
        // Using local-time Date arithmetic — SAFE-03 not violated (three-arg constructor)
        const [y, m, day] = d.date.split('-').map(Number)
        const next = new Date(y, m - 1, day + 1) // local time arithmetic is fine here
        const end: [number, number, number] = [
          next.getFullYear(),
          next.getMonth() + 1,
          next.getDate(),
        ]

        const event: EventAttributes = {
          uid: `${d.id}@case-calendar.local`,
          start,
          end,
          title: `${d.caseLabel} — ${typeMap.get(d.typeId) ?? 'Unknown'}`, // em-dash U+2014
          status: 'CONFIRMED', // NEVER 'CANCELLED' — calendar clients hide cancelled events
          lastModified: sqliteTimestampToUnixMs(d.updatedAt),
          created: sqliteTimestampToUnixMs(d.createdAt),
        }

        // DESCRIPTION: only include when non-empty (per D-04, CONTEXT.md)
        if (d.description?.trim()) {
          event.description = d.description
        }

        return event
      })

      // Generate VCALENDAR string
      const { error, value } = createEvents(events, {
        calName: 'Case Calendar',
        method: 'PUBLISH',
        productId: '-//Case Calendar//Deadlines//EN',
      })

      if (error || !value) {
        logger.error({ err: error }, 'GET /deadlines.ics generation failed')
        return c.json(
          { error: { code: 'ics_error', message: 'Failed to generate calendar feed.' } },
          500
        )
      }

      return c.body(value, 200, {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="case-calendar.ics"',
      })
    } catch (err) {
      logger.error({ err }, 'GET /deadlines.ics failed')
      return c.json(
        { error: { code: 'ics_error', message: 'Failed to generate calendar feed.' } },
        500
      )
    }
  })
}
