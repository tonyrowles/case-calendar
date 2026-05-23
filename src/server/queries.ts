import { db } from './db.js'
import { deadlines, deadlineTypes } from '../../drizzle/schema.js'
import { desc, eq, sql } from 'drizzle-orm'
import type { DeadlineUpdate } from '../shared/schemas/deadline.js'
import type { DeadlineTypeCreate, DeadlineTypeUpdate } from '../shared/schemas/deadlineType.js'

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
 * Update a deadline by id with a partial patch.
 * Returns the updated row or null if the row was not found.
 * Calls notifyMutation() on success (HOOK-04 preserved).
 * The set_deadlines_updated_at trigger auto-bumps updatedAt.
 */
export function updateDeadline(id: number, patch: DeadlineUpdate) {
  const result = db
    .update(deadlines)
    .set(patch)
    .where(eq(deadlines.id, id))
    .returning()
    .get()
  if (result) notifyMutation()
  return result ?? null
}

/**
 * Delete a deadline by id.
 * Returns true if a row was deleted, false if not found.
 * Calls notifyMutation() on success (HOOK-04 preserved).
 */
export function deleteDeadline(id: number): boolean {
  const result = db.delete(deadlines).where(eq(deadlines.id, id)).run()
  if (result.changes > 0) notifyMutation()
  return result.changes > 0
}

/**
 * Count deadlines that reference the given typeId.
 * Used by the DELETE /api/deadline-types/:id route to enforce type_in_use guard.
 */
export function countDeadlinesByType(typeId: number): number {
  return (
    db
      .select({ count: sql<number>`count(*)` })
      .from(deadlines)
      .where(eq(deadlines.typeId, typeId))
      .get()?.count ?? 0
  )
}

/**
 * Fetch a single deadline type by id.
 * Returns null when not found.
 */
export function getDeadlineTypeById(typeId: number) {
  return db.select().from(deadlineTypes).where(eq(deadlineTypes.id, typeId)).get() ?? null
}

/**
 * Create a new deadline type.
 * Calls notifyMutation() on success (HOOK-04 preserved).
 * Throws if the name is not unique (SQLITE_CONSTRAINT_UNIQUE).
 */
export function createDeadlineType(input: DeadlineTypeCreate) {
  const result = db.insert(deadlineTypes).values(input).returning().get()
  if (!result) throw new Error('Insert returned no result')
  notifyMutation()
  return result
}

/**
 * Update a deadline type by id with a partial patch.
 * Returns the updated row or null if the row was not found.
 * Calls notifyMutation() when a row is changed (HOOK-04 preserved).
 * Throws if the new name collides with an existing unique name (SQLITE_CONSTRAINT_UNIQUE).
 */
export function updateDeadlineType(id: number, patch: DeadlineTypeUpdate) {
  const result = db
    .update(deadlineTypes)
    .set(patch)
    .where(eq(deadlineTypes.id, id))
    .returning()
    .get()
  if (result) notifyMutation()
  return result ?? null
}

/**
 * Delete a deadline type by id.
 * Returns true if a row was deleted, false if not found.
 * Calls notifyMutation() when deleted (HOOK-04 preserved).
 * Does NOT enforce "Other" protection or in-use guard — those are route-handler concerns.
 */
export function deleteDeadlineType(typeId: number): boolean {
  const result = db.delete(deadlineTypes).where(eq(deadlineTypes.id, typeId)).run()
  if (result.changes > 0) notifyMutation()
  return result.changes > 0
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
