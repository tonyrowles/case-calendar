import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createDeadlineType,
  updateDeadlineType,
  deleteDeadlineType,
} from '@/client/lib/api.js'

/**
 * Centralized TanStack mutations for deadline type CREATE, PATCH, and DELETE operations.
 *
 * create and remove invalidate ['deadline-types'] only (no deadline rename propagation).
 * update invalidates ['deadline-types'] AND ['deadlines'] because a type rename propagates
 * to rendered type names in deadline rows and calendar pills (Common Pitfall #4).
 *
 * Pessimistic UX throughout (CRUD-02 lock) — no optimistic updates.
 */
export function useDeadlineTypeMutations() {
  const qc = useQueryClient()

  function invalidateTypes() {
    qc.invalidateQueries({ queryKey: ['deadline-types'] })
  }

  function invalidateTypesAndDeadlines() {
    qc.invalidateQueries({ queryKey: ['deadline-types'] })
    qc.invalidateQueries({ queryKey: ['deadlines'] })
  }

  const create = useMutation({
    mutationFn: (input: { name: string; color: string }) => createDeadlineType(input),
    onSuccess: invalidateTypes,
  })

  const update = useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: { name?: string; color?: string } }) =>
      updateDeadlineType(id, patch),
    onSuccess: invalidateTypesAndDeadlines,
  })

  const remove = useMutation({
    mutationFn: (id: number) => deleteDeadlineType(id),
    onSuccess: invalidateTypesAndDeadlines,
  })

  return { create, update, remove }
}
