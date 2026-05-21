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
