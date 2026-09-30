import { describe, it, expect } from 'vitest'
import { canonicalizeCaseLabel, caseMatchKey, findExistingCase, suggestCases } from './case-labels.js'

const LABELS = ['Smith v. Jones', 'Glaukos/Spyglass', 'Garcia v. City of Los Angeles', 'In re Estate of Whitfield', 'Jones v. Smith']

describe('caseMatchKey', () => {
  it('ignores case, punctuation, and spacing', () => {
    expect(caseMatchKey('Smith v. Jones')).toBe('smith v jones')
    expect(caseMatchKey('  smith   V JONES ')).toBe('smith v jones')
    expect(caseMatchKey('Glaukos / Spyglass')).toBe(caseMatchKey('Glaukos/Spyglass'))
  })
})

describe('findExistingCase / canonicalizeCaseLabel', () => {
  it('maps loose variants to the existing label', () => {
    expect(findExistingCase('smith v jones', LABELS)).toBe('Smith v. Jones')
    expect(canonicalizeCaseLabel('glaukos / spyglass ', LABELS)).toBe('Glaukos/Spyglass')
  })

  it('does not merge different cases', () => {
    expect(findExistingCase('Jones v. Smith', LABELS)).toBe('Jones v. Smith')
    expect(findExistingCase('Smith v. Jonestown', LABELS)).toBeNull()
  })

  it('leaves a new case as typed (trimmed)', () => {
    expect(canonicalizeCaseLabel('  Doe v. Roe ', LABELS)).toBe('Doe v. Roe')
    expect(findExistingCase('', LABELS)).toBeNull()
  })
})

describe('suggestCases', () => {
  it('returns all labels alphabetically for empty input', () => {
    expect(suggestCases('', LABELS)).toEqual([
      'Garcia v. City of Los Angeles', 'Glaukos/Spyglass', 'In re Estate of Whitfield', 'Jones v. Smith', 'Smith v. Jones',
    ])
  })

  it('matches loosely and puts prefix matches first', () => {
    expect(suggestCases('jones', LABELS)).toEqual(['Jones v. Smith', 'Smith v. Jones'])
    expect(suggestCases('smith v jon', LABELS)).toEqual(['Smith v. Jones'])
    expect(suggestCases('spyglass', LABELS)).toEqual(['Glaukos/Spyglass'])
  })

  it('respects the limit', () => {
    expect(suggestCases('', LABELS, 2)).toHaveLength(2)
  })
})
