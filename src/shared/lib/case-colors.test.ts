import { describe, it, expect } from 'vitest'
import { CASE_PALETTE, assignCaseColors, caseColor, caseTextColor } from './case-colors.js'

describe('caseTextColor', () => {
  it('uses black on light fills and white on dark fills', () => {
    expect(caseTextColor('#ffe119')).toBe('#000000') // yellow
    expect(caseTextColor('#fffac8')).toBe('#000000') // beige
    expect(caseTextColor('#000075')).toBe('#FFFFFF') // navy
    expect(caseTextColor('#800000')).toBe('#FFFFFF') // maroon
  })

  it('gives every palette color at least 4.5:1 text contrast (WCAG AA)', () => {
    const lum = (hex: string) => {
      const ch = (i: number) => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
      return 0.2126 * ch(1) + 0.7152 * ch(3) + 0.0722 * ch(5)
    }
    for (const bg of CASE_PALETTE) {
      const [a, b] = [lum(bg), lum(caseTextColor(bg))].sort((x, y) => y - x)
      expect((a + 0.05) / (b + 0.05), bg).toBeGreaterThanOrEqual(4.5)
    }
  })
})

describe('assignCaseColors', () => {
  it('gives every case its own color while cases <= palette size', () => {
    const labels = Array.from({ length: CASE_PALETTE.length }, (_, i) => `Matter ${i}`)
    const colors = assignCaseColors(labels)
    expect(new Set(colors.values()).size).toBe(CASE_PALETTE.length)
  })

  it('keeps the preferred color when there is no collision', () => {
    expect(assignCaseColors(['Smith v. Jones']).get('Smith v. Jones')).toBe(caseColor('Smith v. Jones'))
  })

  it('resolves a real collision (same preferred color) to two different colors', () => {
    // Find two labels that hash to the same palette slot
    const seen = new Map<string, string>()
    let pair: [string, string] | null = null
    for (let i = 0; !pair; i++) {
      const label = `Case ${i}`
      const c = caseColor(label)
      if (seen.has(c)) pair = [seen.get(c)!, label]
      else seen.set(c, label)
    }
    const colors = assignCaseColors(pair)
    expect(colors.get(pair[0])).not.toBe(colors.get(pair[1]))
  })

  it('treats label variants as one case (same color)', () => {
    const colors = assignCaseColors(['Smith v. Jones', 'smith v.  jones', 'Doe v. Roe'])
    expect(colors.get('Smith v. Jones')).toBe(colors.get('smith v.  jones'))
  })

  it('still returns a color for every case beyond the palette size', () => {
    const labels = Array.from({ length: CASE_PALETTE.length + 5 }, (_, i) => `Matter ${i}`)
    const colors = assignCaseColors(labels)
    for (const l of labels) expect(CASE_PALETTE).toContain(colors.get(l))
  })
})

describe('caseColor', () => {
  it('always returns a palette color', () => {
    for (const label of ['Smith v. Jones', 'Glaukos/Spyglass', '', 'In re Estate of Whitfield']) {
      expect(CASE_PALETTE).toContain(caseColor(label))
    }
  })

  it('is stable for the same label', () => {
    expect(caseColor('Garcia v. City of Los Angeles')).toBe(caseColor('Garcia v. City of Los Angeles'))
  })

  it('ignores case and surrounding / repeated whitespace', () => {
    expect(caseColor('  smith   v. JONES ')).toBe(caseColor('Smith v. Jones'))
  })

  it('spreads different labels across the palette', () => {
    const labels = Array.from({ length: 200 }, (_, i) => `Case ${i} v. Defendant ${i * 7}`)
    const used = new Set(labels.map(caseColor))
    expect(used.size).toBe(CASE_PALETTE.length)
  })
})
