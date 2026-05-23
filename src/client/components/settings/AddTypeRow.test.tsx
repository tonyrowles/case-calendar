// @vitest-environment jsdom
import { describe, it } from 'vitest'

// TYPE-01: AddTypeRow — submits POST to create a new deadline type
// Plan 03 converts these it.todo stubs to live it() tests.
// NOTE: AddTypeRow component does not yet exist — do NOT import it here.
// Stubs use it.todo to remain vitest-discoverable without compile failures.

describe('TYPE-01: AddTypeRow — add new deadline type', () => {
  it.todo('Add button is disabled when the name input is empty')
  it.todo('Add button is enabled once name input has at least one character')
  it.todo('clicking Add triggers POST /api/deadline-types with name + color')
  it.todo('on 201 response the name input clears and color resets to default')
  it.todo('pressing Enter in the name input triggers the Add action')
  it.todo('409 type_name_taken response shows inline error banner below the row')
})
