import type { Deadline, DeadlineCreate, DeadlineType } from '../../shared/schemas/deadline.js'

export type { Deadline, DeadlineCreate }

export async function getDeadlines(): Promise<Deadline[]> {
  const res = await fetch('/api/deadlines')
  if (!res.ok) throw new Error('Failed to fetch deadlines')
  return res.json()
}

export async function getDeadlineTypes(): Promise<DeadlineType[]> {
  const res = await fetch('/api/deadline-types')
  if (!res.ok) throw new Error('Failed to fetch deadline types')
  return res.json()
}

export async function createDeadline(input: DeadlineCreate): Promise<Deadline> {
  const res = await fetch('/api/deadlines', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? 'Save failed. Check your connection and try again.')
  }
  return res.json()
}

/**
 * Fetch the sorted list of distinct case labels for the CaseCombobox filter.
 * Source: GET /api/case-labels → string[] (Plan 03-02).
 * Consumed by Plan 03-03's CaseCombobox via useQuery(['case-labels']).
 */
export async function getCaseLabels(): Promise<string[]> {
  const res = await fetch('/api/case-labels')
  if (!res.ok) throw new Error('Failed to fetch case labels')
  return res.json()
}
