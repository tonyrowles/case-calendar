// Automatic per-case colors. Cases are free-text labels on deadlines (no cases
// table), so a case's color is derived from its label: the same label always gets
// the same color, with no stored state. Distinct cases can share a color once there
// are more active cases than palette entries.

// 20 maximally distinct colors (Sasha Trubetskoy's list), chosen by the user. Several
// are very light, so render a case color as a fill with caseTextColor() on top, never
// as text on white.
export const CASE_PALETTE = [
  '#e6194B', // red
  '#3cb44b', // green
  '#ffe119', // yellow
  '#4363d8', // blue
  '#f58231', // orange
  '#911eb4', // purple
  '#42d4f4', // cyan
  '#f032e6', // magenta
  '#bfef45', // lime
  '#fabed4', // pink
  '#469990', // teal
  '#dcbeff', // lavender
  '#9A6324', // brown
  '#fffac8', // beige
  '#800000', // maroon
  '#aaffc3', // mint
  '#808000', // olive
  '#ffd8b1', // apricot
  '#000075', // navy
  '#a9a9a9', // gray
] as const

/** WCAG relative luminance of a #RRGGBB color (0 = black, 1 = white). */
function relativeLuminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

/** Black or white, whichever has more contrast on `bgHex` (for text on a case-color fill). */
export function caseTextColor(bgHex: string): '#000000' | '#FFFFFF' {
  const l = relativeLuminance(bgHex)
  // Contrast with black: (l + 0.05) / 0.05; with white: 1.05 / (l + 0.05)
  return (l + 0.05) / 0.05 >= 1.05 / (l + 0.05) ? '#000000' : '#FFFFFF'
}

/** Case-insensitive, whitespace-insensitive key so "Smith v. Jones " and "smith v. jones" match. */
function normalizeCaseLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** 32-bit FNV-1a: small, stable across runs and platforms. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

function preferredIndex(caseLabel: string): number {
  return fnv1a(normalizeCaseLabel(caseLabel)) % CASE_PALETTE.length
}

/** A single case's preferred color (ignores collisions with other cases). */
export function caseColor(caseLabel: string): string {
  return CASE_PALETTE[preferredIndex(caseLabel)]
}

/**
 * Colors for a set of cases shown together, without collisions while there are no
 * more cases than palette entries. Each case keeps its preferred color unless an
 * earlier case (in normalized-label order) already took it; then it takes the next
 * free color. So a case's color only changes when a colliding case appears or goes.
 * Beyond the palette size, colors repeat (preferred color). Keyed by the original label.
 */
export function assignCaseColors(caseLabels: Iterable<string>): Map<string, string> {
  const byKey = new Map<string, string[]>()
  for (const label of caseLabels) {
    const key = normalizeCaseLabel(label)
    const list = byKey.get(key)
    if (list) { if (!list.includes(label)) list.push(label) } else byKey.set(key, [label])
  }
  const taken = new Set<number>()
  const result = new Map<string, string>()
  for (const key of [...byKey.keys()].sort()) {
    let idx = fnv1a(key) % CASE_PALETTE.length
    if (taken.size < CASE_PALETTE.length) {
      while (taken.has(idx)) idx = (idx + 1) % CASE_PALETTE.length
      taken.add(idx)
    }
    for (const label of byKey.get(key)!) result.set(label, CASE_PALETTE[idx])
  }
  return result
}
