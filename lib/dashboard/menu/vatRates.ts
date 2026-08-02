// lib/dashboard/menu/vatRates.ts
//
// Dutch VAT rates in basis points, matching menu_items.vat_rate_bp (CHECK
// 0..10000). Every live item is currently 900; nothing in the codebase
// defined these values before D4.3, so this file is the first place they
// exist as named constants.

export const VAT_LOW_BP = 900 // 9% — food, non-alcoholic drinks
export const VAT_HIGH_BP = 2100 // 21% — alcohol, other

export const VAT_OPTIONS = [
  { value: VAT_LOW_BP, labelKey: 'low' },
  { value: VAT_HIGH_BP, labelKey: 'high' },
] as const

export const VALID_VAT_RATES: readonly number[] = VAT_OPTIONS.map((o) => o.value)

export function formatVatRate(bp: number): string {
  return `${Math.round(bp / 100)}%`
}

/**
 * True when an item is tagged as alcoholic but priced at the low VAT rate.
 * Surfaced as a non-blocking warning: the owner keeps control of a
 * money-affecting field, we only point out the likely mistake.
 */
export function isAlcoholVatMismatch(dietaryTags: string[], vatRateBp: number): boolean {
  return dietaryTags.includes('contains_alcohol') && vatRateBp === VAT_LOW_BP
}
