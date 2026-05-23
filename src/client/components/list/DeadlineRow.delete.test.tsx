// @vitest-environment jsdom
import { describe, it } from 'vitest'

// CRUD-04: DeadlineRow 2-step inline delete confirmation
// Plan 03 converts these it.todo stubs to live it() tests.
// NOTE: DeadlineRow does not yet expose onDelete prop — do NOT import it here.
// Stubs use it.todo to remain vitest-discoverable without compile failures.

describe('CRUD-04: DeadlineRow — 2-step inline delete confirmation', () => {
  it.todo('Delete button is hidden until row is hovered')
  it.todo('first click changes button label to "Are you sure?"')
  it.todo('second click changes label to "Confirm Delete" and fires onDelete callback')
  it.todo('clicking outside the row resets confirm state to idle')
  it.todo('Escape key resets confirm state to idle')
  it.todo('8-second timeout with no second click resets state to idle')
})
