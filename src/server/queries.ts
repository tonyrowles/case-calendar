import { db } from './db.js'
import { deadlines, deadlineTypes } from '../../drizzle/schema.js'
import { desc } from 'drizzle-orm'

// HOOK-04: Phase 9 wallpaper worker subscribes here
let onMutationCallback: (() => void) | null = null
export function onMutation(cb: () => void): void {
  onMutationCallback = cb
}
function notifyMutation(): void {
  onMutationCallback?.()
}

export function getAllDeadlines() {
  return db.select().from(deadlines)
    .orderBy(desc(deadlines.createdAt))
    .all()
}

export function getAllDeadlineTypes() {
  return db.select().from(deadlineTypes).all()
}

export function createDeadline(input: {
  date: string
  caseLabel: string
  typeId: number
  description?: string
}) {
  const result = db.insert(deadlines).values(input).returning().get()
  if (!result) {
    throw new Error('Insert returned no result')
  }
  notifyMutation()
  return result
}

/**
 * Return a sorted list of distinct non-empty case labels from the deadlines table.
 * Used by GET /api/case-labels (Plan 03-02).
 *
 * SELECT DISTINCT case_label FROM deadlines WHERE case_label != '' ORDER BY case_label
 * Empty strings are excluded to handle any rows that bypassed Zod's min(1) validation
 * at the DB layer (RESEARCH Common Pitfall #9).
 */
export function listDistinctCaseLabels(): string[] {
  return db
    .selectDistinct({ label: deadlines.caseLabel })
    .from(deadlines)
    .orderBy(deadlines.caseLabel)
    .all()
    .map(r => r.label)
    .filter(l => l.length > 0)
}
