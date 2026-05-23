// @vitest-environment jsdom
// Wave 0 stub. Wave 1 (Plan 02) implements EventPill.
// These todos become live it() tests when EventPill.tsx is created in Plan 02 Task 1.
import { describe, it } from 'vitest'

describe('EventPill (VIEW-01)', () => {
  it.todo('renders left border in type color from getColor(typeId)')
  it.todo('renders left border in red-700 (#B91C1C) when isOverdue is true regardless of type color')
  it.todo('renders case label as text content (truncated via flex-1 truncate)')
  it.todo('renders TYPE_ABBREV[typeName] when known (Filing -> FIL, Hearing -> HRG, ...)')
  it.todo('falls back to typeName.slice(0, 3).toUpperCase() for unknown types')
  it.todo('applies text-red-700 to case label when isOverdue is true')
  it.todo('does not use dangerouslySetInnerHTML anywhere')
})
