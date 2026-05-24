/**
 * SAFE checklist: catalog of SAFE-01..10 requirements.
 *
 * Asserts that every SAFE-XX requirement in .planning/REQUIREMENTS.md has
 * verifiable coverage — either an existing test file on disk (asserted via
 * fs.existsSync) or a documented smoke-procedure tag in the catalog map.
 *
 * This ensures the SAFE checklist never silently loses a coverage row as
 * implementation evolves across Plans 02-04.
 *
 * Key assertions (when implemented by Plan 04):
 *   SAFE-07 → tests/safe-07-bind-loopback.test.ts must exist
 *   SAFE-09 → tests/safe-09-no-external-network.test.ts must exist
 *   SAFE-03 → tests/date-guard.test.ts must exist (already GREEN from Phase 1)
 *   SAFE-06 → tests/type-color-source.test.ts must exist (already GREEN from Phase 1)
 *   All other SAFE-XX rows must have either a test file or a 'smoke:' tag entry
 *
 * The catalog may be parsed from .planning/REQUIREMENTS.md or maintained as a
 * hand-curated map — Plan 04 will decide the implementation approach.
 *
 * Wave 0 (this file): RED stub — fails immediately with a MISSING message.
 * Wave 3 (Plan 04): Implements the real catalog parse + fs.existsSync assertions.
 */
import { describe, it, expect } from 'vitest'

describe('SAFE checklist: every SAFE-01..10 requirement has a proof artifact (test file or documented smoke procedure)', () => {
  it('every SAFE-XX row in REQUIREMENTS.md has either a corresponding test file or a smoke-procedure tag', () => {
    expect.fail(
      'MISSING — Plan 04 will parse SAFE-01..10 from .planning/REQUIREMENTS.md (or maintain a hand-curated map), and assert each SAFE-XX has either fs.existsSync(<test-file>) === true OR a \'smoke:\' tag in the map; SAFE-09 must reference tests/safe-09-no-external-network.test.ts; SAFE-07 must reference tests/safe-07-bind-loopback.test.ts'
    )
  })
})
