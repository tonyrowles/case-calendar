import { describe, it } from 'vitest'

// CRUD-05/06: applyFilters honors showCompleted flag
// Plan 03 converts these it.todo stubs to live it() tests.
// NOTE: applyFilters does not yet accept showCompleted — do NOT call it here.
// Stubs use it.todo to remain vitest-discoverable without compile failures.

describe('applyFilters — showCompleted behavior (CRUD-05, CRUD-06)', () => {
  it.todo('showCompleted=false excludes deadlines where completedAt is not null')
  it.todo('showCompleted=true keeps deadlines regardless of completedAt value')
  it.todo('showCompleted filter is independent of case/type/range filters')
})
