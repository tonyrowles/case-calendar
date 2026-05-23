// @vitest-environment jsdom
import { describe, it } from 'vitest'

// CRUD-05/07: DeadlineRow per-row checkbox for mark/unmark complete
// Plan 03 converts these it.todo stubs to live it() tests.
// NOTE: DeadlineRow does not yet expose onComplete prop — do NOT import it here.
// Stubs use it.todo to remain vitest-discoverable without compile failures.

describe('CRUD-05/07: DeadlineRow — mark/unmark complete checkbox', () => {
  it.todo('checkbox is unchecked when completedAt === null')
  it.todo('checkbox is checked when completedAt is a non-null timestamp')
  it.todo('clicking checkbox fires onComplete(id, true) with ISO timestamp shape when marking complete')
  it.todo('clicking checkbox stops row-click event propagation')
  it.todo('aria-label toggles between "Mark X complete" and "Mark X incomplete" based on state')
})
