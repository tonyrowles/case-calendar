// Wave 1 (Plan 02) implements the hook.
// No // @vitest-environment jsdom — pure logic test, runs in Node.
// These todos become live it() tests when useTypeColors.ts is created in Plan 02.
import { describe, it } from 'vitest'

describe('useTypeColors query key (HOOK-05)', () => {
  it.todo('exports DEADLINE_TYPES_QUERY_KEY equal to [\'deadline-types\']')
  it.todo('matches the query key used in DeadlineForm and DeadlinesTable')
})

describe('useTypeColors fallback behavior', () => {
  it.todo('getColor(unknownId) returns \'#374151\' fallback')
  it.todo('getColor(unknownId) emits exactly one console.warn for each unique unknownId')
  it.todo('getColor(knownId) returns the hex from the loaded types map')
})
