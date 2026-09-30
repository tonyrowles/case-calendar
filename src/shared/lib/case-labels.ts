// Case-label matching for the Case picker. Cases are free-text labels on deadlines
// (no cases table), so consistency comes from steering input toward labels that
// already exist: "smith v jones" and "Smith v. Jones" are the same case.

/**
 * Loose comparison key: lowercase, punctuation and symbols become spaces, runs of
 * whitespace collapse. "Smith v. Jones" -> "smith v jones";
 * "Glaukos / Spyglass" and "Glaukos/Spyglass" -> "glaukos spyglass".
 */
export function caseMatchKey(label: string): string {
  return label.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
}

/**
 * The existing label that `input` refers to (same loose key), or null if it names a
 * new case. When several existing labels share the key, the first in `labels` wins.
 */
export function findExistingCase(input: string, labels: readonly string[]): string | null {
  const key = caseMatchKey(input)
  if (!key) return null
  return labels.find(l => caseMatchKey(l) === key) ?? null
}

/** `input` snapped to the existing label it matches; otherwise `input` trimmed. */
export function canonicalizeCaseLabel(input: string, labels: readonly string[]): string {
  return findExistingCase(input, labels) ?? input.trim()
}

/**
 * Existing labels matching what has been typed so far (loose substring match),
 * labels starting with the input first, then alphabetical. Empty input -> all labels.
 */
export function suggestCases(input: string, labels: readonly string[], limit = 8): string[] {
  const key = caseMatchKey(input)
  const byName = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' })
  if (!key) return [...labels].sort(byName).slice(0, limit)
  const matches = labels.filter(l => caseMatchKey(l).includes(key))
  const starts = matches.filter(l => caseMatchKey(l).startsWith(key)).sort(byName)
  const rest = matches.filter(l => !caseMatchKey(l).startsWith(key)).sort(byName)
  return [...starts, ...rest].slice(0, limit)
}
