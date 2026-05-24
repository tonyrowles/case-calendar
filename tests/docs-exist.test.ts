/**
 * Static check that Phase 6 documentation artifacts exist with required anchors.
 *
 * Each anchor is a heading or unique line the README/runbook MUST contain.
 * Catches accidental deletion or refactor that drops a required section.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

type DocSpec = { path: string; anchors: string[] }

const DOCS: DocSpec[] = [
  {
    path: 'README.md',
    anchors: ['# Case Calendar', '## Self-host on Windows', '## SAFE Checklist', 'docs/DEPLOYMENT.md', '| SAFE-01 ', '| SAFE-10 '],
  },
  {
    path: 'docs/README.md',
    anchors: ['DEPLOYMENT.md'],
  },
  {
    path: 'docs/DEPLOYMENT.md',
    anchors: [
      '# Self-host on Windows',
      '## Prerequisites',
      '## Install',
      '## Verify',
      '## Post-Install Reboot Verification (OPS-04)',
      '## Update Procedure',
      '## Troubleshoot',
      '## Uninstall',
      '## SAFE Checklist Summary',
      'scripts\\nssm-install.ps1',
      '127.0.0.1:3747',
      'Pacific Standard Time',
    ],
  },
  {
    path: 'scripts/nssm-install.ps1',
    anchors: [
      'param(',
      '$ServiceName',
      'SERVICE_AUTO_START',
      'AppEnvironmentExtra',
      'TZ=America/Los_Angeles',
      'NODE_ENV=production',
      'nssm remove',
      'Pacific Standard Time',
      'dist\\server\\src\\server\\index.js',
    ],
  },
]

describe('OPS-03: Phase 6 documentation artifacts exist with required anchors', () => {
  for (const doc of DOCS) {
    describe(doc.path, () => {
      it('file exists', () => {
        expect(fs.existsSync(doc.path), `${doc.path} missing`).toBe(true)
      })
      const content = fs.existsSync(doc.path) ? fs.readFileSync(doc.path, 'utf-8') : ''
      for (const anchor of doc.anchors) {
        it(`contains anchor: ${JSON.stringify(anchor).slice(0, 80)}`, () => {
          expect(content, `${doc.path} missing anchor "${anchor}"`).toContain(anchor)
        })
      }
    })
  }
})
