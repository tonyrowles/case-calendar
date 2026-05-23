// @vitest-environment jsdom
import { describe, it } from 'vitest'

// CRUD-03: DeadlineForm dual-mode (create vs edit)
// Plan 03 converts these it.todo stubs to live it() tests.
// NOTE: DeadlineForm component does not yet have edit-mode props — do NOT import it here.
// Stubs use it.todo to remain vitest-discoverable without compile failures.

describe('CRUD-03: DeadlineForm — dual-mode (edit vs create)', () => {
  it.todo('heading shows "Edit Deadline" and "(editing)" badge when deadline prop is set')
  it.todo('fields prefill from deadline.values when in edit mode')
  it.todo('Save Changes button triggers PATCH not POST when editing')
  it.todo('Cancel button calls onCancel callback and does not submit')
  it.todo('transition: deadline prop becomes null → form resets to create mode')
})
