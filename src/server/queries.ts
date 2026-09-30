import { db, sqlite } from './db.js'
import { appSettings, archivedCases, caseColors, deadlines, deadlineTypes, emailImports } from '../../drizzle/schema.js'
import { desc, eq, sql } from 'drizzle-orm'
import type { DeadlineUpdate } from '../shared/schemas/deadline.js'
import type { DeadlineTypeCreate, DeadlineTypeUpdate } from '../shared/schemas/deadlineType.js'
import { caseColorKey, type CaseColorOverride } from '../shared/lib/case-colors.js'
import type { CaseSummary } from '../shared/schemas/cases.js'
import type { EmailImport, EmailImportStatus } from '../shared/schemas/email-imports.js'
import type { DeadlineProposal } from '../shared/schemas/imports.js'

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

// --- Case color overrides (user-chosen colors; see case_colors in drizzle/schema.ts) ---

export function getAllCaseColors(): CaseColorOverride[] {
  return db
    .select({ caseLabel: caseColors.caseLabel, color: caseColors.color })
    .from(caseColors)
    .orderBy(caseColors.caseLabel)
    .all()
}

/**
 * Pin a case to a color (insert or replace), keyed by the normalized label so
 * "Smith v. Jones" and "smith v.  jones" share one override.
 * Notifies the wallpaper worker (HOOK-04): colors are visible on the wallpaper.
 */
export function setCaseColor(caseLabel: string, color: string): CaseColorOverride {
  const caseKey = caseColorKey(caseLabel)
  const row = db
    .insert(caseColors)
    .values({ caseKey, caseLabel, color })
    .onConflictDoUpdate({
      target: caseColors.caseKey,
      set: { caseLabel, color, updatedAt: sql`(CURRENT_TIMESTAMP)` },
    })
    .returning({ caseLabel: caseColors.caseLabel, color: caseColors.color })
    .get()
  if (!row) throw new Error('Upsert returned no result')
  notifyMutation()
  return row
}

/** Remove a case's override (back to its automatic color). Returns false if none existed. */
export function deleteCaseColor(caseLabel: string): boolean {
  const result = db.delete(caseColors).where(eq(caseColors.caseKey, caseColorKey(caseLabel))).run()
  if (result.changes > 0) notifyMutation()
  return result.changes > 0
}

// --- App settings (key/value) ---

export function getSetting(key: string): string | null {
  return db.select({ value: appSettings.value }).from(appSettings).where(eq(appSettings.key, key)).get()?.value ?? null
}

/** Upsert a setting. Notifies the wallpaper worker (HOOK-04): settings can change the wallpaper. */
export function setSetting(key: string, value: string): void {
  db.insert(appSettings)
    .values({ key, value })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: sql`(CURRENT_TIMESTAMP)` } })
    .run()
  notifyMutation()
}

/** Wake the wallpaper worker for a change that isn't a database write (e.g. a new background image). */
export function notifyWallpaperInputsChanged(): void {
  notifyMutation()
}

// --- Case management (Settings > Cases): summaries, rename/merge, archive ---

export function listCases(): CaseSummary[] {
  const rows = db
    .select({
      caseLabel: deadlines.caseLabel,
      totalCount: sql<number>`count(*)`,
      openCount: sql<number>`sum(case when ${deadlines.completedAt} is null then 1 else 0 end)`,
    })
    .from(deadlines)
    .groupBy(deadlines.caseLabel)
    .orderBy(deadlines.caseLabel)
    .all()
  const archived = new Set(db.select({ caseKey: archivedCases.caseKey }).from(archivedCases).all().map(r => r.caseKey))
  return rows
    .filter(r => r.caseLabel.length > 0)
    .map(r => ({
      caseLabel: r.caseLabel,
      openCount: Number(r.openCount),
      totalCount: Number(r.totalCount),
      archived: archived.has(caseColorKey(r.caseLabel)),
    }))
}

/**
 * Rename a case on every deadline that uses exactly `from`. If `to` is another existing
 * case, this merges the two. A chosen color follows the case unless `to` already has one;
 * archive state stays with the destination. Returns the number of deadlines changed.
 */
export function renameCase(from: string, to: string): number {
  const fromKey = caseColorKey(from)
  const toKey = caseColorKey(to)
  const changed = sqlite.transaction(() => {
    const result = db.update(deadlines).set({ caseLabel: to }).where(eq(deadlines.caseLabel, from)).run()
    if (result.changes === 0) return 0
    if (fromKey !== toKey) {
      const fromColor = db.select().from(caseColors).where(eq(caseColors.caseKey, fromKey)).get()
      const toColor = db.select().from(caseColors).where(eq(caseColors.caseKey, toKey)).get()
      if (fromColor && !toColor) {
        db.insert(caseColors).values({ caseKey: toKey, caseLabel: to, color: fromColor.color }).run()
      }
      db.delete(caseColors).where(eq(caseColors.caseKey, fromKey)).run()
      db.delete(archivedCases).where(eq(archivedCases.caseKey, fromKey)).run()
    } else {
      // Respelling only (same key): keep the stored labels in step
      db.update(caseColors).set({ caseLabel: to }).where(eq(caseColors.caseKey, fromKey)).run()
      db.update(archivedCases).set({ caseLabel: to }).where(eq(archivedCases.caseKey, fromKey)).run()
    }
    return result.changes
  })()
  if (changed > 0) notifyMutation()
  return changed
}

export function setCaseArchived(caseLabel: string, archived: boolean): void {
  const caseKey = caseColorKey(caseLabel)
  if (archived) {
    db.insert(archivedCases).values({ caseKey, caseLabel }).onConflictDoNothing().run()
  } else {
    db.delete(archivedCases).where(eq(archivedCases.caseKey, caseKey)).run()
  }
}

/**
 * Insert several deadlines in one transaction (all or nothing), then notify the
 * wallpaper worker once. Returns the number created.
 */
export function createDeadlines(inputs: Array<{ date: string; caseLabel: string; typeId: number; description?: string }>): number {
  sqlite.transaction(() => {
    for (const input of inputs) db.insert(deadlines).values(input).run()
  })()
  if (inputs.length > 0) notifyMutation()
  return inputs.length
}

// --- Email imports (emailed orders waiting for review; see email_imports) ---

type EmailImportRow = typeof emailImports.$inferSelect

function toEmailImport(r: EmailImportRow): EmailImport {
  return {
    id: r.id,
    fromAddress: r.fromAddress,
    subject: r.subject,
    receivedAt: r.receivedAt,
    status: r.status as EmailImportStatus,
    reason: r.reason,
    proposals: r.proposals ? (JSON.parse(r.proposals) as DeadlineProposal[]) : [],
  }
}

export function hasEmailImport(messageId: string): boolean {
  return db.select({ id: emailImports.id }).from(emailImports).where(eq(emailImports.messageId, messageId)).get() !== undefined
}

export function addEmailImport(row: {
  messageId: string
  fromAddress: string
  subject: string
  receivedAt: string
  status: EmailImportStatus
  reason?: string | null
  proposals?: DeadlineProposal[]
}): void {
  db.insert(emailImports).values({
    ...row,
    reason: row.reason ?? null,
    proposals: row.proposals ? JSON.stringify(row.proposals) : null,
  }).onConflictDoNothing().run()
  // A new email to review shows on the wallpaper
  if (row.status === 'pending') notifyMutation()
}

/** Pending first, then anything that wasn't imported (rejected/failed), newest first. */
export function listEmailImports(): EmailImport[] {
  return db.select().from(emailImports)
    .where(sql`${emailImports.status} in ('pending', 'rejected', 'failed')`)
    .orderBy(desc(emailImports.receivedAt))
    .all()
    .map(toEmailImport)
    .sort((a, b) => Number(b.status === 'pending') - Number(a.status === 'pending'))
}

export function getEmailImport(id: number): EmailImport | null {
  const r = db.select().from(emailImports).where(eq(emailImports.id, id)).get()
  return r ? toEmailImport(r) : null
}

export function setEmailImportStatus(id: number, status: EmailImportStatus): boolean {
  const changed = db.update(emailImports).set({ status }).where(eq(emailImports.id, id)).run().changes > 0
  if (changed) notifyMutation()
  return changed
}

/** Save the reviewed deadlines and mark the email done, in one transaction. */
export function acceptEmailImport(id: number, inputs: Array<{ date: string; caseLabel: string; typeId: number; description?: string }>): number {
  sqlite.transaction(() => {
    for (const input of inputs) db.insert(deadlines).values(input).run()
    db.update(emailImports).set({ status: 'done' }).where(eq(emailImports.id, id)).run()
  })()
  notifyMutation()
  return inputs.length
}
