// lib/dashboard/menu/itemValidation.ts
//
// Shared item-patch validation for the client dialog and every mutating
// route. The server always re-validates the normalized patch and is the
// authority.
//
// menu_items carries only two CHECK constraints (price_cents >= 0, and
// vat_rate_bp between 0 and 10000). Everything else — non-empty name, length
// caps, the 9%/21% VAT restriction, known-tag enforcement — exists only here.

import { ALLERGEN_CODES, DIET_CODES } from '@/lib/menu/allergens'
import { VALID_VAT_RATES } from './vatRates'

export type ItemPatch = {
  category_id: string
  name_nl: string
  name_en?: string | null
  description_nl?: string | null
  description_en?: string | null
  price_cents: number
  vat_rate_bp: number
  dietary_tags: string[]
  visible_takeaway: boolean
  visible_qr: boolean
  available: boolean
}

export type ValidationError = { field: string; code: string }

export const MAX_ITEM_NAME_LENGTH = 80
export const MAX_DESCRIPTION_LENGTH = 500
/** €999.99 — a higher price is almost certainly a decimal-point slip, not a real dish. */
export const MAX_PRICE_CENTS = 99999
export const MAX_TAGS = 20

const VALID_TAGS = new Set<string>([...ALLERGEN_CODES, ...DIET_CODES])
const VALID_VAT = new Set<number>(VALID_VAT_RATES)
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function validateItemPatch(patch: ItemPatch): ValidationError[] {
  const errors: ValidationError[] = []

  if (!patch.category_id || !UUID_RE.test(patch.category_id)) {
    errors.push({ field: 'category_id', code: 'category_id_required' })
  }

  const trimmedNl = (patch.name_nl ?? '').trim()
  if (trimmedNl.length === 0) errors.push({ field: 'name_nl', code: 'name_nl_required' })
  else if (trimmedNl.length > MAX_ITEM_NAME_LENGTH) errors.push({ field: 'name_nl', code: 'name_nl_too_long' })

  if (patch.name_en != null && patch.name_en.trim().length > MAX_ITEM_NAME_LENGTH) {
    errors.push({ field: 'name_en', code: 'name_en_too_long' })
  }

  if (patch.description_nl != null && patch.description_nl.length > MAX_DESCRIPTION_LENGTH) {
    errors.push({ field: 'description_nl', code: 'description_nl_too_long' })
  }
  if (patch.description_en != null && patch.description_en.length > MAX_DESCRIPTION_LENGTH) {
    errors.push({ field: 'description_en', code: 'description_en_too_long' })
  }

  // €0.00 is deliberately allowed — tap water, complimentary bread.
  if (!Number.isInteger(patch.price_cents)) errors.push({ field: 'price_cents', code: 'price_not_integer' })
  else if (patch.price_cents < 0) errors.push({ field: 'price_cents', code: 'price_negative' })
  else if (patch.price_cents > MAX_PRICE_CENTS) errors.push({ field: 'price_cents', code: 'price_too_high' })

  if (!VALID_VAT.has(patch.vat_rate_bp)) errors.push({ field: 'vat_rate_bp', code: 'vat_invalid' })

  if (!Array.isArray(patch.dietary_tags)) {
    errors.push({ field: 'dietary_tags', code: 'tags_not_array' })
  } else {
    if (patch.dietary_tags.length > MAX_TAGS) errors.push({ field: 'dietary_tags', code: 'too_many_tags' })
    for (const tag of patch.dietary_tags) {
      if (typeof tag !== 'string') {
        errors.push({ field: 'dietary_tags', code: 'tag_invalid' })
        break
      }
      // Unknown tags are rejected on write so no garbage reaches the column;
      // splitTags() would silently drop them on the consumer surface, making
      // a typo invisible rather than loud.
      if (!VALID_TAGS.has(tag)) {
        errors.push({ field: 'dietary_tags', code: 'tag_unknown' })
        break
      }
    }
  }

  if (typeof patch.visible_takeaway !== 'boolean') errors.push({ field: 'visible_takeaway', code: 'invalid_visibility' })
  if (typeof patch.visible_qr !== 'boolean') errors.push({ field: 'visible_qr', code: 'invalid_visibility' })
  if (typeof patch.available !== 'boolean') errors.push({ field: 'available', code: 'invalid_availability' })

  return errors
}

/** Trims text, collapses blank strings to null. Tags are expected to already be canonical (`normalizeDietaryTags`). */
export function normalizeItemPatch(patch: ItemPatch): ItemPatch {
  return {
    category_id: patch.category_id,
    name_nl: (patch.name_nl ?? '').trim(),
    name_en: patch.name_en?.trim() || null,
    description_nl: patch.description_nl?.trim() || null,
    description_en: patch.description_en?.trim() || null,
    price_cents: patch.price_cents,
    vat_rate_bp: patch.vat_rate_bp,
    dietary_tags: patch.dietary_tags,
    visible_takeaway: patch.visible_takeaway,
    visible_qr: patch.visible_qr,
    available: patch.available,
  }
}

/** Shape-check an untrusted body. Field rules belong to `validateItemPatch`; this only rejects bodies that aren't item patches at all. */
export function parseItemPatchBody(raw: unknown): ItemPatch | null {
  if (typeof raw !== 'object' || raw === null) return null
  const b = raw as Record<string, unknown>

  if (typeof b.category_id !== 'string') return null
  if (typeof b.name_nl !== 'string') return null
  if (b.name_en != null && typeof b.name_en !== 'string') return null
  if (b.description_nl != null && typeof b.description_nl !== 'string') return null
  if (b.description_en != null && typeof b.description_en !== 'string') return null
  if (typeof b.price_cents !== 'number') return null
  if (typeof b.vat_rate_bp !== 'number') return null
  if (!Array.isArray(b.dietary_tags)) return null
  if (typeof b.visible_takeaway !== 'boolean') return null
  if (typeof b.visible_qr !== 'boolean') return null
  if (typeof b.available !== 'boolean') return null

  return {
    category_id: b.category_id,
    name_nl: b.name_nl,
    name_en: (b.name_en as string | null | undefined) ?? null,
    description_nl: (b.description_nl as string | null | undefined) ?? null,
    description_en: (b.description_en as string | null | undefined) ?? null,
    price_cents: b.price_cents,
    vat_rate_bp: b.vat_rate_bp,
    dietary_tags: b.dietary_tags as string[],
    visible_takeaway: b.visible_takeaway,
    visible_qr: b.visible_qr,
    available: b.available,
  }
}

/**
 * Parse an owner-typed price into cents. Accepts both Dutch ("12,50") and
 * English ("12.50") decimal separators. Returns null when the input isn't a
 * price at all — callers surface `price_not_integer`.
 */
export function parsePriceInput(input: string): number | null {
  const trimmed = input.trim().replace(/^€\s*/, '').replace(',', '.')
  if (trimmed === '' || !/^\d*\.?\d*$/.test(trimmed)) return null
  const value = Number(trimmed)
  if (!Number.isFinite(value)) return null
  return Math.round(value * 100)
}

/** Cents → the plain decimal string the price input shows (no currency symbol). */
export function formatPriceInput(cents: number): string {
  return (cents / 100).toFixed(2)
}
