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
export function relativeLuminance(hex: string): number {
  const channel = (i: number) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5)
}

/** WCAG contrast ratio between two #RRGGBB colors (1 to 21). */
export function contrastRatio(aHex: string, bHex: string): number {
  const [hi, lo] = [relativeLuminance(aHex), relativeLuminance(bHex)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

/**
 * For dark wallpaper themes: blend a case color toward white just until it has at
 * least `minContrast` against the dark background, so navy/maroon-type colors stay
 * visible. Colors that already stand out are returned unchanged.
 */
export function liftForDarkBackground(hex: string, darkBgHex: string, minContrast = 3): string {
  if (contrastRatio(hex, darkBgHex) >= minContrast) return hex
  const rgb = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16))
  for (let t = 0.05; t <= 1; t += 0.05) {
    const mixed = '#' + rgb.map(c => Math.round(c + (255 - c) * t).toString(16).padStart(2, '0')).join('').toUpperCase()
    if (contrastRatio(mixed, darkBgHex) >= minContrast) return mixed
  }
  return '#FFFFFF'
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

/** Key identifying a case for colors (and stored overrides): case/whitespace-insensitive. */
export function caseColorKey(caseLabel: string): string {
  return normalizeCaseLabel(caseLabel)
}

/** A user-chosen color for a case (stored in case_colors). */
export type CaseColorOverride = { caseLabel: string; color: string }

/**
 * Colors for a set of cases shown together.
 *
 * - Overrides (user-chosen colors) win and are applied first.
 * - Every other case keeps its preferred color unless it is already taken (by an
 *   override or by an earlier case in normalized-label order); then it takes the next
 *   free color. So while there are no more cases than palette entries, no two cases
 *   share a color, and a case's color only changes when a colliding case appears/goes.
 * - Beyond the palette size, automatic colors repeat (preferred color). Two cases can
 *   also share a color if the user pins them to the same one.
 *
 * Keyed by the original label.
 */
export function assignCaseColors(
  caseLabels: Iterable<string>,
  overrides: Iterable<CaseColorOverride> = [],
): Map<string, string> {
  const pinned = new Map<string, string>()
  for (const o of overrides) pinned.set(caseColorKey(o.caseLabel), o.color)

  const byKey = new Map<string, string[]>()
  for (const label of caseLabels) {
    const key = caseColorKey(label)
    const list = byKey.get(key)
    if (list) { if (!list.includes(label)) list.push(label) } else byKey.set(key, [label])
  }

  // Reserve every pinned color up front (even for cases not currently shown), so an
  // automatic color never lands on a color the user picked for another case.
  const taken = new Set<number>()
  for (const color of pinned.values()) {
    const idx = (CASE_PALETTE as readonly string[]).indexOf(color)
    if (idx !== -1) taken.add(idx)
  }

  const result = new Map<string, string>()
  for (const key of [...byKey.keys()].sort()) {
    const chosen = pinned.get(key)
    let color: string
    if (chosen !== undefined) {
      color = chosen
    } else {
      let idx = fnv1a(key) % CASE_PALETTE.length
      if (taken.size < CASE_PALETTE.length) {
        while (taken.has(idx)) idx = (idx + 1) % CASE_PALETTE.length
        taken.add(idx)
      }
      color = CASE_PALETTE[idx]
    }
    for (const label of byKey.get(key)!) result.set(label, color)
  }
  return result
}
