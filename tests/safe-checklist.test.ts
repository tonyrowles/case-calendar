/**
 * SAFE catalog: every SAFE-XX requirement maps to a proof artifact.
 *
 * Hand-maintained map — adding a new SAFE-XX requirement requires adding a row here.
 * Per .planning/REQUIREMENTS.md, Phase 6 is the last SAFE-adding phase in v1.
 * Phase 8+ (Tailscale) may introduce new SAFE rows — extend SAFE_PROOF_MAP at that time.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

type ProofEntry = { description: string; proof: string; type: 'test' | 'smoke' }

export const SAFE_PROOF_MAP: Record<string, ProofEntry> = {
  'SAFE-01': { description: 'Date round-trip across US timezones (LA/Chicago/NY)', proof: 'src/server/tz.test.ts', type: 'test' },
  'SAFE-02': { description: 'DST boundary correctness',                            proof: 'src/server/tz.test.ts', type: 'test' },
  'SAFE-03': { description: 'No raw new Date(string) outside date util',           proof: 'tests/date-guard.test.ts', type: 'test' },
  'SAFE-04': { description: 'SQLite PRAGMA on startup (WAL + foreign_keys)',       proof: 'src/server/db.test.ts', type: 'test' },
  'SAFE-05': { description: 'VACUUM INTO backup + 30-day retention',               proof: 'src/server/backup.test.ts', type: 'test' },
  'SAFE-06': { description: 'Persistent error banner on 500',                      proof: 'src/client/App.crud.test.tsx', type: 'test' },
  'SAFE-07': { description: 'Hono binds 127.0.0.1 only',                          proof: 'tests/safe-07-bind-loopback.test.ts', type: 'test' },
  'SAFE-08': { description: 'CORS explicit allowlist',                             proof: 'src/server/cors.test.ts', type: 'test' },
  'SAFE-09': { description: 'No external network in src/client',                   proof: 'tests/safe-09-no-external-network.test.ts', type: 'test' },
  'SAFE-10': { description: 'req.user middleware placeholder',                     proof: 'src/server/user-middleware.test.ts', type: 'test' },
}

describe('SAFE checklist: every SAFE-01..10 has a proof artifact', () => {
  const ALL_IDS = Array.from({ length: 10 }, (_, i) => `SAFE-${String(i + 1).padStart(2, '0')}`)

  it.each(ALL_IDS)('%s has a map entry', (id) => {
    expect(SAFE_PROOF_MAP[id], `Missing SAFE_PROOF_MAP entry for ${id}`).toBeDefined()
  })

  it.each(ALL_IDS)('%s proof exists on disk (or is a documented smoke procedure)', (id) => {
    const entry = SAFE_PROOF_MAP[id]
    if (entry.type === 'test') {
      expect(fs.existsSync(entry.proof), `Proof file missing for ${id}: ${entry.proof}`).toBe(true)
    } else {
      expect(entry.proof.length, `${id} smoke description must be non-empty`).toBeGreaterThan(0)
    }
  })
})
