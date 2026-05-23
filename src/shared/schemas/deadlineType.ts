import { z } from 'zod'

// deadlineTypeCreateSchema — validates body for POST /api/deadline-types
// color must be a 6-char hex literal per TYPE-06 color system enforcement
export const deadlineTypeCreateSchema = z
  .object({
    name: z.string().min(1).max(64),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a 6-digit hex (e.g. #1D4ED8)'),
  })
  .strict()

// deadlineTypeUpdateSchema — validates body for PATCH /api/deadline-types/:id
// All fields optional; .strict() rejects unknown keys; .refine ensures at least one field
export const deadlineTypeUpdateSchema = deadlineTypeCreateSchema
  .partial()
  .strict()
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field required',
  })

export type DeadlineTypeCreate = z.infer<typeof deadlineTypeCreateSchema>
export type DeadlineTypeUpdate = z.infer<typeof deadlineTypeUpdateSchema>
