import { z } from 'zod'

const label = z.string().trim().min(1, 'Case name is required').max(200)

/** POST /api/cases/rename: rename (or, if `to` already exists, merge) a case */
export const caseRenameSchema = z.object({ from: label, to: label }).strict()

/** PUT /api/cases/archive */
export const caseArchiveSchema = z.object({ caseLabel: label, archived: z.boolean() }).strict()

/** One row of GET /api/cases */
export interface CaseSummary {
  caseLabel: string
  /** Deadlines not marked complete (past or future) */
  openCount: number
  totalCount: number
  archived: boolean
}
