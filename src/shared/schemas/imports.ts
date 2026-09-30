import { z } from 'zod'
import { deadlineCreateSchema } from './deadline.js'

/** POST /api/deadlines/extract */
export const extractRequestSchema = z.object({
  text: z.string().trim().min(1, 'Paste the text to import').max(50_000, 'Text is too long (50,000 characters max)'),
  /** Optional: the case the text is about */
  caseLabel: z.string().trim().max(200).nullable().optional(),
}).strict()

/** One proposed deadline, for review before saving */
export interface DeadlineProposal {
  date: string
  caseLabel: string
  typeId: number
  title: string
  notes: string
  /** stated = the text gives the date; computed = derived (show `basis`, ask the user to verify) */
  dateBasis: 'stated' | 'computed'
  basis: string
  sourceText: string
}

/** POST /api/deadlines/bulk: save the reviewed proposals in one transaction */
export const bulkCreateSchema = z.object({
  deadlines: z.array(deadlineCreateSchema).min(1).max(200),
}).strict()

/** description stored on the deadline: title on the first line, details after */
export function proposalDescription(p: Pick<DeadlineProposal, 'title' | 'notes'>): string {
  const title = p.title.trim()
  const notes = p.notes.trim()
  return notes ? `${title}\n${notes}` : title
}
