// @vitest-environment jsdom
import { describe, it } from 'vitest'

// CRUD-06: FilterBar — "Show completed" Switch wired to URL param ?completed=1
// Plan 03 converts these it.todo stubs to live it() tests.
// NOTE: FilterBar does not yet have the Show completed Switch — do NOT import it here.
// Stubs use it.todo to remain vitest-discoverable without compile failures.

describe('CRUD-06: FilterBar — "Show completed" Switch', () => {
  it.todo('Switch renders with label "Show completed"')
  it.todo('Switch is off (unchecked) by default when ?completed param is absent')
  it.todo('toggling Switch on sets ?completed=1 in the URL search params')
  it.todo('toggling Switch off removes the ?completed param from the URL')
})
