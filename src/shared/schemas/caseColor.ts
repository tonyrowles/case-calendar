import { z } from 'zod'
import { CASE_PALETTE } from '../lib/case-colors.js'
export type { CaseColorOverride } from '../lib/case-colors.js'

/** PUT /api/case-colors body: pin a case to one of the palette colors. */
export const caseColorSetSchema = z.object({
  caseLabel: z.string().trim().min(1, 'Case label is required').max(200),
  color: z.enum(CASE_PALETTE),
}).strict()

export type CaseColorSet = z.infer<typeof caseColorSetSchema>
