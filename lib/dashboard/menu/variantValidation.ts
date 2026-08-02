// lib/dashboard/menu/variantValidation.ts
//
// menu_item_variants is a thin table: id, item_id, name_nl,
// price_delta_cents, created_at. No name_en (variants are Dutch-only in
// D4.3), no display_order (ordered by created_at), and no CHECK on the
// delta — so the signed range is enforced here.

export type VariantPatch = {
  name_nl: string
  /** Signed: negative supports discount variants ("Kleine portie −€3,00"). */
  price_delta_cents: number
}

export type ValidationError = { field: string; code: string }

export const MAX_VARIANT_NAME_LENGTH = 60
export const MAX_PRICE_DELTA_CENTS = 99999

export function validateVariantPatch(patch: VariantPatch): ValidationError[] {
  const errors: ValidationError[] = []

  const trimmed = (patch.name_nl ?? '').trim()
  if (trimmed.length === 0) errors.push({ field: 'name_nl', code: 'variant_name_required' })
  else if (trimmed.length > MAX_VARIANT_NAME_LENGTH) {
    errors.push({ field: 'name_nl', code: 'variant_name_too_long' })
  }

  if (!Number.isInteger(patch.price_delta_cents)) {
    errors.push({ field: 'price_delta_cents', code: 'price_delta_not_integer' })
  } else if (Math.abs(patch.price_delta_cents) > MAX_PRICE_DELTA_CENTS) {
    errors.push({ field: 'price_delta_cents', code: 'price_delta_too_extreme' })
  }

  return errors
}

export function normalizeVariantPatch(patch: VariantPatch): VariantPatch {
  return { name_nl: (patch.name_nl ?? '').trim(), price_delta_cents: patch.price_delta_cents }
}

export function parseVariantPatchBody(raw: unknown): VariantPatch | null {
  if (typeof raw !== 'object' || raw === null) return null
  const b = raw as Record<string, unknown>
  if (typeof b.name_nl !== 'string') return null
  if (typeof b.price_delta_cents !== 'number') return null
  return { name_nl: b.name_nl, price_delta_cents: b.price_delta_cents }
}

/** Parse a signed price delta the owner typed ("+1,50", "-3.00", "1.50"). Returns null on garbage. */
export function parseDeltaInput(input: string): number | null {
  const trimmed = input.trim().replace(/^\+/, '').replace('−', '-').replace('€', '').trim().replace(',', '.')
  if (trimmed === '' || trimmed === '-' || !/^-?\d*\.?\d*$/.test(trimmed)) return null
  const value = Number(trimmed)
  if (!Number.isFinite(value)) return null
  return Math.round(value * 100)
}

/** Cents → a sign-explicit label: "+ € 1,50" / "− € 3,00" / "€ 0,00". */
export function formatDelta(cents: number): string {
  const abs = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(Math.abs(cents) / 100)
  if (cents > 0) return `+ ${abs}`
  if (cents < 0) return `− ${abs}`
  return abs
}
