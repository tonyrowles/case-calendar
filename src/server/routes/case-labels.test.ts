// Wave 0 stub — GET /api/case-labels route
// Plan 03-02 (Wave 1) converts these it.todo stubs to live it() tests.
//
// Route: GET /api/case-labels → string[] (sorted distinct case labels from deadlines table)
// Security: DB error returns structured 500 with db_error code
import { describe, it } from 'vitest'

describe('GET /api/case-labels — Wave 0 stubs', () => {
  it.todo('CL1: returns sorted distinct case labels as string[] from the deadlines table')
  it.todo('CL2: empty strings are excluded from the returned label list')
  it.todo('CL3: DB error returns structured 500 response with db_error code')
})
