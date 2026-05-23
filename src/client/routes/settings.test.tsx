// @vitest-environment jsdom
import { describe, it } from 'vitest'

// TYPE-01..04: Settings page — types list, AddTypeRow, no FilterBar
// Plan 03 converts these it.todo stubs to live it() tests.
// NOTE: settings.tsx route does not yet exist — do NOT import it here.
// Stubs use it.todo to remain vitest-discoverable without compile failures.

describe('Settings page (TYPE-01..04)', () => {
  it.todo('renders "Settings" h2 heading and "Deadline Types" h3 subheading')
  it.todo('types list loads from ["deadline-types"] query cache')
  it.todo('AddTypeRow renders at the bottom of the types list')
  it.todo('FilterBar is NOT rendered on the settings page')
  it.todo('back link navigating to / exists on the page')
})
