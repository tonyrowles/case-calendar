// @vitest-environment jsdom
import { describe, it } from 'vitest'

// Integration: edit/delete/complete reflected in both calendar+list views
// Plan 04 converts these it.todo stubs to live it() tests.
// NOTE: App CRUD mutations and row click handler do not yet exist — do NOT import here.
// Stubs use it.todo to remain vitest-discoverable without compile failures.

describe('App — CRUD integration (CRUD-03/04/05/06/07)', () => {
  it.todo('clicking a row in list view loads the deadline into the form in edit mode')
  it.todo('saving an edit patches the deadline and the update is reflected in both list and calendar')
  it.todo('deleting a deadline removes it from both the list view and the calendar')
  it.todo('marking a deadline complete hides it from the default list (no ?completed=1)')
  it.todo('marking a deadline complete keeps it visible when ?completed=1 is set')
})
