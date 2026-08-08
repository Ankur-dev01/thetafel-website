// lib/dashboard/settings/bookingRulesValidation.ts
//
// Shared booking-rules-payload validation, imported by BOTH the client
// editor and the mutating route. The client copy is UX only — the server
// always re-validates the parsed payload (and re-checks tier/Mollie against
// a fresh DB read, never the client's copy) before writing.
//
// Column note: targets `max_party_size_online`, NOT the sibling
// `max_party_size` column. `max_party_size` is dead — the consumer booking
// flow reads `max_party_size_online` exclusively (lib/booking/config.ts:13-22,
// :155). Writing to `max_party_size` would round-trip in this editor while
// having zero effect on what a guest can actually book. See D9.4 for the
// cleanup migration to drop the dead column.
//
// `noshow_prepaid_threshold` is included because `lib/booking/types.ts:156-163`
// returns false (no deposit required) when threshold is null — a bare
// on/off prepaid toggle with no threshold would silently collect nothing.
// `noshow_prepaid_window` (day/time gating) is intentionally NOT part of
// this payload — never read, never written, existing values preserved as-is
// (see D9.4).
//
// Unlike hoursValidation/floorPlanValidation, the server contract here is a
// single { code, message } — not a field-level ValidationError[] — because
// the D5.3 spec calls for specific top-level codes (whatsapp_needs_premium,
// prepaid_needs_mollie, prepaid_threshold_required,
// template_missing_restaurant, template_unknown_placeholder) that the
// client maps directly to distinct error copy, rather than a generic bundle.

export type BookingRulesPayload = {
  min_lead_time_minutes: number
  max_party_size_online: number | null
  booking_window_days: number
  max_guests_per_slot: number | null
  waitlist_enabled: boolean
  guest_zone_choice_enabled: boolean
  noshow_reminders_email_enabled: boolean
  noshow_reminders_whatsapp_enabled: boolean
  noshow_reconfirmation_enabled: boolean
  noshow_prepaid_enabled: boolean
  noshow_prepaid_amount_cents: number | null
  noshow_prepaid_threshold: number | null
  confirmation_template_nl: string
  confirmation_template_en: string
  booking_question_allergies: boolean
  booking_question_occasion: boolean
  booking_question_requests: boolean
}

export type BookingRulesValidationContext = {
  /** Freshly reloaded server-side — never trust a client-supplied tier. */
  isPremiumTier: boolean
  /** Freshly reloaded server-side — never trust a client-supplied Mollie state. */
  mollieVerified: boolean
}

export type BookingRulesError = { code: string; message: string; token?: string }

export const MIN_LEAD_TIME_OPTIONS = [0, 30, 60, 120, 240, 1440] as const
export const MAX_PARTY_SIZE_ONLINE_OPTIONS = [2, 4, 6, 8, 10, 12, 15, 20] as const
export const BOOKING_WINDOW_OPTIONS = [7, 14, 30, 60, 90, 180, 365] as const
export const MIN_MAX_GUESTS_PER_SLOT = 2
export const MAX_MAX_GUESTS_PER_SLOT = 500
export const MIN_PREPAID_AMOUNT_CENTS = 100
export const PREPAID_THRESHOLD_OPTIONS = [1, 2, 4, 6, 8] as const
export const MIN_PREPAID_THRESHOLD = 1
export const MAX_PREPAID_THRESHOLD = 20
export const MAX_TEMPLATE_LENGTH = 5000

/** The only placeholder tokens a confirmation template may use. */
export const KNOWN_PLACEHOLDERS = ['naam', 'restaurant', 'datum', 'tijd', 'gasten', 'adres'] as const
const PLACEHOLDER_RE = /\{([a-zA-Z]+)\}/g

/**
 * Parse an untrusted request body into a BookingRulesPayload shape. Returns
 * null when the body isn't even shaped like one — callers answer 400
 * invalid_body. Business rules are validateBookingRulesPayload's job.
 */
export function parseBookingRulesPayload(raw: unknown): BookingRulesPayload | null {
  if (typeof raw !== 'object' || raw === null) return null
  const b = raw as Record<string, unknown>

  const optionalInt = (v: unknown) => v === null || (typeof v === 'number' && Number.isInteger(v))

  if (typeof b.min_lead_time_minutes !== 'number' || !Number.isInteger(b.min_lead_time_minutes)) return null
  if (!optionalInt(b.max_party_size_online)) return null
  if (typeof b.booking_window_days !== 'number' || !Number.isInteger(b.booking_window_days)) return null
  if (!optionalInt(b.max_guests_per_slot)) return null
  if (typeof b.waitlist_enabled !== 'boolean') return null
  if (typeof b.guest_zone_choice_enabled !== 'boolean') return null
  if (typeof b.noshow_reminders_email_enabled !== 'boolean') return null
  if (typeof b.noshow_reminders_whatsapp_enabled !== 'boolean') return null
  if (typeof b.noshow_reconfirmation_enabled !== 'boolean') return null
  if (typeof b.noshow_prepaid_enabled !== 'boolean') return null
  if (!optionalInt(b.noshow_prepaid_amount_cents)) return null
  if (!optionalInt(b.noshow_prepaid_threshold)) return null
  if (typeof b.confirmation_template_nl !== 'string') return null
  if (typeof b.confirmation_template_en !== 'string') return null
  if (typeof b.booking_question_allergies !== 'boolean') return null
  if (typeof b.booking_question_occasion !== 'boolean') return null
  if (typeof b.booking_question_requests !== 'boolean') return null

  return {
    min_lead_time_minutes: b.min_lead_time_minutes,
    max_party_size_online: b.max_party_size_online as number | null,
    booking_window_days: b.booking_window_days,
    max_guests_per_slot: b.max_guests_per_slot as number | null,
    waitlist_enabled: b.waitlist_enabled,
    guest_zone_choice_enabled: b.guest_zone_choice_enabled,
    noshow_reminders_email_enabled: b.noshow_reminders_email_enabled,
    noshow_reminders_whatsapp_enabled: b.noshow_reminders_whatsapp_enabled,
    noshow_reconfirmation_enabled: b.noshow_reconfirmation_enabled,
    noshow_prepaid_enabled: b.noshow_prepaid_enabled,
    noshow_prepaid_amount_cents: b.noshow_prepaid_amount_cents as number | null,
    noshow_prepaid_threshold: b.noshow_prepaid_threshold as number | null,
    confirmation_template_nl: b.confirmation_template_nl,
    confirmation_template_en: b.confirmation_template_en,
    booking_question_allergies: b.booking_question_allergies,
    booking_question_occasion: b.booking_question_occasion,
    booking_question_requests: b.booking_question_requests,
  }
}

/** First unknown placeholder token in `template`, or null if all tokens are known. */
function findUnknownPlaceholder(template: string): string | null {
  const known = new Set<string>(KNOWN_PLACEHOLDERS)
  PLACEHOLDER_RE.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = PLACEHOLDER_RE.exec(template)) !== null) {
    if (!known.has(match[1])) return match[1]
  }
  return null
}

/**
 * Business rules for a booking-rules save payload. Returns the first
 * violation found (deterministic check order) as a single { code, message },
 * or null when the payload is fully valid. Server callers must pass a
 * FRESHLY reloaded `context` — never the client's copy of tier/Mollie state.
 */
export function validateBookingRulesPayload(
  payload: BookingRulesPayload,
  context: BookingRulesValidationContext,
): BookingRulesError | null {
  if (!(MIN_LEAD_TIME_OPTIONS as readonly number[]).includes(payload.min_lead_time_minutes)) {
    return { code: 'validation_error', message: 'Invalid min_lead_time_minutes.' }
  }
  if (
    payload.max_party_size_online !== null &&
    !(MAX_PARTY_SIZE_ONLINE_OPTIONS as readonly number[]).includes(payload.max_party_size_online)
  ) {
    return { code: 'validation_error', message: 'Invalid max_party_size_online.' }
  }
  if (!(BOOKING_WINDOW_OPTIONS as readonly number[]).includes(payload.booking_window_days)) {
    return { code: 'validation_error', message: 'Invalid booking_window_days.' }
  }
  if (payload.max_guests_per_slot !== null) {
    if (payload.max_guests_per_slot < MIN_MAX_GUESTS_PER_SLOT || payload.max_guests_per_slot > MAX_MAX_GUESTS_PER_SLOT) {
      return { code: 'validation_error', message: 'max_guests_per_slot out of range.' }
    }
  }

  if (payload.noshow_reminders_whatsapp_enabled && !context.isPremiumTier) {
    return { code: 'whatsapp_needs_premium', message: 'WhatsApp reminders require the Premium tier.' }
  }

  if (payload.noshow_prepaid_enabled) {
    if (!context.mollieVerified) {
      return { code: 'prepaid_needs_mollie', message: 'Prepaid bookings require a verified Mollie connection.' }
    }
    if (payload.noshow_prepaid_amount_cents === null || payload.noshow_prepaid_amount_cents < MIN_PREPAID_AMOUNT_CENTS) {
      return { code: 'validation_error', message: 'noshow_prepaid_amount_cents must be at least 100 (€1).' }
    }
    if (
      payload.noshow_prepaid_threshold === null ||
      payload.noshow_prepaid_threshold < MIN_PREPAID_THRESHOLD ||
      payload.noshow_prepaid_threshold > MAX_PREPAID_THRESHOLD
    ) {
      return {
        code: 'prepaid_threshold_required',
        message: 'Kies vanaf welke groepsgrootte vooruitbetaling geldt.',
      }
    }
  } else {
    if (payload.noshow_prepaid_amount_cents !== null) {
      return { code: 'validation_error', message: 'noshow_prepaid_amount_cents must be null when prepaid is off.' }
    }
    if (payload.noshow_prepaid_threshold !== null) {
      return { code: 'validation_error', message: 'noshow_prepaid_threshold must be null when prepaid is off.' }
    }
  }

  if (payload.confirmation_template_nl.length > MAX_TEMPLATE_LENGTH || payload.confirmation_template_en.length > MAX_TEMPLATE_LENGTH) {
    return { code: 'validation_error', message: 'Confirmation template too long.' }
  }
  if (!payload.confirmation_template_nl.includes('{restaurant}')) {
    return { code: 'template_missing_restaurant', message: 'The Dutch confirmation template must contain {restaurant}.' }
  }
  if (!payload.confirmation_template_en.includes('{restaurant}')) {
    return { code: 'template_missing_restaurant', message: 'The English confirmation template must contain {restaurant}.' }
  }
  const unknownNl = findUnknownPlaceholder(payload.confirmation_template_nl)
  if (unknownNl) {
    return { code: 'template_unknown_placeholder', message: `Unknown variable: {${unknownNl}}`, token: unknownNl }
  }
  const unknownEn = findUnknownPlaceholder(payload.confirmation_template_en)
  if (unknownEn) {
    return { code: 'template_unknown_placeholder', message: `Unknown variable: {${unknownEn}}`, token: unknownEn }
  }

  return null
}
