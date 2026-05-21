import { db } from './db.js'
import { deadlines, deadlineTypes } from '../../drizzle/schema.js'
import { desc } from 'drizzle-orm'

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
  return result
}
// NOTE: onMutation() hook is added in Plan 01-03 Task HOOK-04.
// The plan-03 task will edit this file to add the hook around the existing function body.
