// lib/dashboard/menu/categoryValidation.ts
//
// Shared category-patch validation, imported by BOTH the client dialog and
// every mutating route. The client copy is UX only — the server always
// re-validates the normalized patch before writing, and is the authority.
//
// No DB constraint backs any of this: menu_categories has zero CHECK
// constraints (name_nl is merely NOT NULL, so '' inserts fine, and
// display_order accepts negatives), so these rules exist only here.

export type CategoryPatch = {
  name_nl: string
  name_en?: string | null
  /** 'HH:MM' wall clock — menu_categories.window_start/end are `time` columns, no date or zone. */
  window_start?: string | null
  window_end?: string | null
  visible_takeaway: boolean
  visible_qr: boolean
}

export type ValidationError = { field: string; code: string }

export const MAX_NAME_LENGTH = 60

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/** Trims names, collapses blank strings to null, and leaves the booleans alone. Always run before validating or writing. */
export function normalizeCategoryPatch(patch: CategoryPatch): CategoryPatch {
  return {
    name_nl: (patch.name_nl ?? '').trim(),
    // '' → null: the consumer render (lib/menu/fetchMenu.ts pickLocalised)
    // falls back to Dutch on any falsy English value, so null is simply the
    // honest representation of "not translated".
    name_en: patch.name_en?.trim() || null,
    window_start: patch.window_start ? patch.window_start : null,
    window_end: patch.window_end ? patch.window_end : null,
    visible_takeaway: patch.visible_takeaway,
    visible_qr: patch.visible_qr,
  }
}

export function validateCategoryPatch(patch: CategoryPatch): ValidationError[] {
  const errors: ValidationError[] = []

  const trimmedNl = (patch.name_nl ?? '').trim()
  if (trimmedNl.length === 0) errors.push({ field: 'name_nl', code: 'name_nl_required' })
  else if (trimmedNl.length > MAX_NAME_LENGTH) errors.push({ field: 'name_nl', code: 'name_nl_too_long' })

  if (patch.name_en != null && patch.name_en.trim().length > MAX_NAME_LENGTH) {
    errors.push({ field: 'name_en', code: 'name_en_too_long' })
  }

  // Window is both-or-neither. When set: HH:MM, and same-day only — there is
  // no wrap-around-midnight support anywhere (nothing consumes these columns
  // on the consumer side yet), so start must strictly precede end.
  const hasStart = patch.window_start != null && patch.window_start !== ''
  const hasEnd = patch.window_end != null && patch.window_end !== ''
  if (hasStart !== hasEnd) {
    errors.push({ field: 'window', code: 'window_both_or_neither' })
  } else if (hasStart && hasEnd) {
    const startValid = HHMM_RE.test(patch.window_start!)
    const endValid = HHMM_RE.test(patch.window_end!)
    if (!startValid || !endValid) errors.push({ field: 'window', code: 'window_invalid_format' })
    else if (patch.window_start! >= patch.window_end!) {
      errors.push({ field: 'window', code: 'window_start_after_end' })
    }
  }

  if (typeof patch.visible_takeaway !== 'boolean') {
    errors.push({ field: 'visible_takeaway', code: 'invalid_visibility' })
  }
  if (typeof patch.visible_qr !== 'boolean') {
    errors.push({ field: 'visible_qr', code: 'invalid_visibility' })
  }

  return errors
}

/**
 * Parse an untrusted request body into a CategoryPatch shape. Returns null
 * when the body isn't even shaped like one — callers answer 400 invalid_body.
 * Field-level rules are `validateCategoryPatch`'s job, not this function's.
 */
export function parseCategoryPatchBody(raw: unknown): CategoryPatch | null {
  if (typeof raw !== 'object' || raw === null) return null
  const body = raw as Record<string, unknown>

  if (typeof body.name_nl !== 'string') return null
  if (body.name_en != null && typeof body.name_en !== 'string') return null
  if (body.window_start != null && typeof body.window_start !== 'string') return null
  if (body.window_end != null && typeof body.window_end !== 'string') return null
  if (typeof body.visible_takeaway !== 'boolean') return null
  if (typeof body.visible_qr !== 'boolean') return null

  return {
    name_nl: body.name_nl,
    name_en: (body.name_en as string | null | undefined) ?? null,
    window_start: (body.window_start as string | null | undefined) ?? null,
    window_end: (body.window_end as string | null | undefined) ?? null,
    visible_takeaway: body.visible_takeaway,
    visible_qr: body.visible_qr,
  }
}
