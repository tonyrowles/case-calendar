import type { Deadline, DeadlineCreate, DeadlineType, DeadlineUpdate } from '../../shared/schemas/deadline.js'
import type { CaseColorOverride } from '../../shared/lib/case-colors.js'

export type { Deadline, DeadlineCreate }

/**
 * ApiError extends Error with a `code` property so consumers can branch
 * on specific server error codes (e.g., 'type_in_use', 'type_protected').
 */
export class ApiError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

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

/** GET /api/case-colors: the cases whose color the user has chosen. */
export async function getCaseColors(): Promise<CaseColorOverride[]> {
  const res = await fetch('/api/case-colors')
  if (!res.ok) throw new Error('Failed to fetch case colors')
  return res.json()
}

/** PUT /api/case-colors: pin a case to one of the palette colors. */
export async function setCaseColor(caseLabel: string, color: string): Promise<CaseColorOverride> {
  const res = await fetch('/api/case-colors', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ caseLabel, color }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? 'Could not save the color. Try again.')
  }
  return res.json()
}

/** DELETE /api/case-colors?caseLabel=: back to the automatic color (a 404 means already automatic). */
export async function resetCaseColor(caseLabel: string): Promise<void> {
  const res = await fetch(`/api/case-colors?caseLabel=${encodeURIComponent(caseLabel)}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? 'Could not reset the color. Try again.')
  }
}

/**
 * PATCH /api/deadlines/:id — partial update.
 * Accepts any subset of DeadlineCreate fields plus completedAt.
 * Returns the updated Deadline on 200; throws on 4xx/5xx.
 */
export async function updateDeadline(id: number, patch: DeadlineUpdate): Promise<Deadline> {
  const res = await fetch(`/api/deadlines/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? 'Update failed. Check your connection and try again.')
  }
  return res.json()
}

/**
 * DELETE /api/deadlines/:id — hard delete.
 * Returns void on 204; throws on 4xx/5xx.
 */
export async function deleteDeadline(id: number): Promise<void> {
  const res = await fetch(`/api/deadlines/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new Error(body?.error?.message ?? 'Delete failed. Check your connection and try again.')
  }
}

/**
 * POST /api/deadline-types — create a new deadline type.
 * Returns the created DeadlineType on 201; throws ApiError on 4xx/5xx.
 */
export async function createDeadlineType(input: { name: string; color: string }): Promise<DeadlineType> {
  const res = await fetch('/api/deadline-types', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const code = body?.error?.code ?? 'unknown'
    const message = body?.error?.message ?? 'Save failed. Check your connection and try again.'
    throw new ApiError(message, code)
  }
  return res.json()
}

/**
 * PATCH /api/deadline-types/:id — partial update (name and/or color).
 * Returns the updated DeadlineType on 200; throws ApiError on 4xx/5xx.
 */
export async function updateDeadlineType(
  id: number,
  patch: { name?: string; color?: string }
): Promise<DeadlineType> {
  const res = await fetch(`/api/deadline-types/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const code = body?.error?.code ?? 'unknown'
    const message = body?.error?.message ?? 'Update failed. Check your connection and try again.'
    throw new ApiError(message, code)
  }
  return res.json()
}

/**
 * DELETE /api/deadline-types/:id — delete a deadline type.
 * Returns void on 204; throws ApiError on 4xx/5xx (including 409 type_in_use / type_protected).
 */
export async function deleteDeadlineType(id: number): Promise<void> {
  const res = await fetch(`/api/deadline-types/${id}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const code = body?.error?.code ?? 'unknown'
    const message = body?.error?.message ?? 'Delete failed. Check your connection and try again.'
    throw new ApiError(message, code)
  }
}

/**
 * The structured result returned by POST /api/deadlines/parse (NL-02).
 * Matches the server response shape defined in Plan 02.
 */
export interface ParsedDeadlineResult {
  caseLabel: string
  typeId: number
  date: string
  description: string | null
}

/**
 * POST /api/deadlines/parse — parse free-text into a structured deadline (NL-02).
 * Returns the parsed shape on 200; throws ApiError with `code` on 4xx/5xx so
 * CommandPaletteShell can branch on err.code === 'parser_unconfigured' / 'parser_timeout' / 'parse_failed'.
 */
export async function parseDeadline(text: string): Promise<ParsedDeadlineResult> {
  const res = await fetch('/api/deadlines/parse', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    const code = body?.error?.code ?? 'unknown'
    const message = body?.error?.message ?? 'Parser unreachable. Try again.'
    throw new ApiError(message, code)
  }
  return res.json()
}
