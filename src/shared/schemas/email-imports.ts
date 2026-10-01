import { z } from 'zod'
import { deadlineCreateSchema } from './deadline.js'
import type { DeadlineProposal } from './imports.js'

export type EmailImportStatus = 'pending' | 'done' | 'dismissed' | 'rejected' | 'failed'

/** One emailed order, as shown in the app's Inbox */
export interface EmailImport {
  id: number
  fromAddress: string
  subject: string
  receivedAt: string
  status: EmailImportStatus
  /** Why it was rejected/failed */
  reason: string | null
  proposals: DeadlineProposal[]
}

/** GET /api/email-imports */
export interface EmailInbox {
  enabled: boolean
  /** The address to send orders to, when enabled */
  address: string | null
  items: EmailImport[]
  lastCheck: { at: string; ok: boolean; error: string | null } | null
}

/** POST /api/email-imports/:id/accept */
export const emailAcceptSchema = z.object({
  deadlines: z.array(deadlineCreateSchema).min(1).max(200),
}).strict()
