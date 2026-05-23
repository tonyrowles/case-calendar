import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { DeadlineUpdate } from '@/shared/schemas/deadline.js'
import { updateDeadline, deleteDeadline } from '@/client/lib/api.js'

/**
 * Centralized TanStack mutations for deadline PATCH and DELETE operations.
 *
 * Both mutations invalidate ['deadlines'] AND ['case-labels'] on success:
 * - ['deadlines'] so the list/calendar re-render with updated data
 * - ['case-labels'] because caseLabel can change via PATCH, refreshing the
 *   CaseCombobox filter options (RESEARCH Pattern 4 / Common Pitfall #4)
 *
 * Pessimistic UX throughout (CRUD-02 lock) — no optimistic updates.
 */
export function useDeadlineMutations() {
  const qc = useQueryClient()

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['deadlines'] })
    qc.invalidateQueries({ queryKey: ['case-labels'] })
  }

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: DeadlineUpdate }) =>
      updateDeadline(id, patch),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteDeadline(id),
    onSuccess: invalidate,
  })

  return { update, remove }
}
