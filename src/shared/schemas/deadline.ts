import { z } from 'zod'
import { parseLocalDate } from '../lib/date.js'

export const deadlineCreateSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
    .refine((s) => parseLocalDate(s) !== null, 'Invalid calendar date'),
  caseLabel: z.string().min(1, 'Case label is required').max(200),
  typeId: z.number().int().positive(),
  description: z.string().max(2000).optional(),
})

export const deadlineSchema = deadlineCreateSchema.extend({
  id: z.number().int(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type DeadlineCreate = z.infer<typeof deadlineCreateSchema>
export type Deadline = z.infer<typeof deadlineSchema>

// deadlineUpdateSchema — partial update schema for PATCH /api/deadlines/:id
// All fields optional; .strict() rejects unknown keys (T-04-02-01 Tampering mitigation);
// .refine ensures at least one field is present (RESEARCH Common Pitfall #1)
export const deadlineUpdateSchema = z
  .object({
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
      .refine((s) => parseLocalDate(s) !== null, 'Invalid calendar date')
      .optional(),
    caseLabel: z.string().min(1).max(200).optional(),
    typeId: z.number().int().positive().optional(),
    description: z.string().max(2000).nullable().optional(),
    completedAt: z.string().datetime().nullable().optional(),
  })
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field required',
  })

export type DeadlineUpdate = z.infer<typeof deadlineUpdateSchema>

// Minimal type shape for deadline types (full Drizzle inference used on server side)
export const deadlineTypeSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  color: z.string(),
  createdAt: z.string(),
})

export type DeadlineType = z.infer<typeof deadlineTypeSchema>
