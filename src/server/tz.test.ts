import { describe, it, expect } from 'vitest'

describe('DATA-06: Timezone enforcement', () => {
  it('process.env.TZ is America/Los_Angeles', () => {
    // cross-env TZ=America/Los_Angeles in npm scripts enforces this
    expect(process.env.TZ).toBe('America/Los_Angeles')
  })
})
