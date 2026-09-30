import { canonicalizeCaseLabel } from '../../shared/lib/case-labels.js'
import type { DeadlineProposal } from '../../shared/schemas/imports.js'
import type { RawExtraction } from './deadline-extractor.js'

/**
 * Turn raw model output into reviewable proposals: resolve the type name to a type id
 * (case-insensitive, else "Other", else the first type), snap case names onto existing
 * cases, and fall back to the case hint when the model gave no case.
 */
export function toProposals(
  raw: RawExtraction[],
  types: Array<{ id: number; name: string }>,
  knownCases: string[],
  caseHint: string | null,
): DeadlineProposal[] {
  const byName = new Map(types.map(t => [t.name.toLowerCase(), t.id]))
  const fallbackTypeId = byName.get('other') ?? types[0]?.id
  return raw.map(d => {
    const caseRaw = d.caseLabel.trim() || caseHint?.trim() || ''
    return {
      date: d.date,
      caseLabel: caseRaw ? canonicalizeCaseLabel(caseRaw, knownCases) : '',
      typeId: byName.get(d.typeName.trim().toLowerCase()) ?? fallbackTypeId!,
      title: d.title.trim(),
      notes: d.notes.trim(),
      dateBasis: d.dateBasis,
      basis: d.basis.trim(),
      sourceText: d.sourceText.trim(),
    }
  })
}
