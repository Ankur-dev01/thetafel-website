// lib/dashboard/menu/normalizeTags.ts
//
// dietary_tags had no writer before D4.3, so there was no stored order to
// inherit. Canonicalising here keeps audit diffs meaningful: without it, a
// tag picker that emits in click order would make every save look like a
// change even when the set is identical.

import { ALLERGEN_CODES, DIET_CODES } from '@/lib/menu/allergens'

const CANONICAL_ORDER: readonly string[] = [...ALLERGEN_CODES, ...DIET_CODES]

/**
 * Dedupe, then sort: known codes first in canonical order, anything else
 * alphabetically after them. Unknown tags are preserved rather than dropped —
 * the taxonomy may grow ahead of these constants, and silently discarding a
 * tag on an unrelated edit would be data loss. (Create/update still *reject*
 * unknown tags at validation; this ordering only matters for values that
 * already exist in the row.)
 */
export function normalizeDietaryTags(tags: string[]): string[] {
  const unique = new Set(tags)
  const known = CANONICAL_ORDER.filter((code) => unique.has(code))
  const unknown = [...unique].filter((code) => !CANONICAL_ORDER.includes(code)).sort()
  return [...known, ...unknown]
}
