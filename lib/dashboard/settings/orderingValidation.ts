// lib/dashboard/settings/orderingValidation.ts
//
// Shared ordering(takeaway)-settings-payload validation, imported by BOTH
// the client editor and the mutating route. The client copy is UX only —
// the server always re-validates the parsed payload, and separately
// re-checks `service_takeaway_enabled` against a fresh DB read (never the
// client's copy) before writing.
//
// Unlike hoursValidation/floorPlanValidation, the server contract here is a
// single { code, message } (matches D5.3's bookingRulesValidation idiom),
// not a field-level ValidationError[].

export type OrderingPayload = {
  takeaway_prep_time_minutes: number
  takeaway_min_order_cents: number
  takeaway_slot_interval_minutes: number
  takeaway_accepting_orders: boolean
  takeaway_item_notes_allowed: boolean
  takeaway_scheduled_orders_allowed: boolean
}

export type OrderingValidationContext = {
  /** Freshly reloaded server-side — never trust a client-supplied copy. */
  serviceTakeawayEnabled: boolean
}

export type OrderingError = { code: string; message: string }

export const PREP_TIME_OPTIONS = [10, 15, 20, 25, 30, 45, 60] as const
export const SLOT_INTERVAL_OPTIONS = [10, 15, 20, 30] as const
export const MIN_ORDER_CENTS_MAX = 100_000 // €1000 sanity ceiling

/**
 * Parse an untrusted request body into an OrderingPayload shape. Returns
 * null when the body isn't even shaped like one — callers answer 400
 * invalid_body. Business rules are validateOrderingPayload's job.
 */
export function parseOrderingPayload(raw: unknown): OrderingPayload | null {
  if (typeof raw !== 'object' || raw === null) return null
  const b = raw as Record<string, unknown>

  if (typeof b.takeaway_prep_time_minutes !== 'number' || !Number.isInteger(b.takeaway_prep_time_minutes)) return null
  if (typeof b.takeaway_min_order_cents !== 'number' || !Number.isInteger(b.takeaway_min_order_cents)) return null
  if (typeof b.takeaway_slot_interval_minutes !== 'number' || !Number.isInteger(b.takeaway_slot_interval_minutes)) {
    return null
  }
  if (typeof b.takeaway_accepting_orders !== 'boolean') return null
  if (typeof b.takeaway_item_notes_allowed !== 'boolean') return null
  if (typeof b.takeaway_scheduled_orders_allowed !== 'boolean') return null

  return {
    takeaway_prep_time_minutes: b.takeaway_prep_time_minutes,
    takeaway_min_order_cents: b.takeaway_min_order_cents,
    takeaway_slot_interval_minutes: b.takeaway_slot_interval_minutes,
    takeaway_accepting_orders: b.takeaway_accepting_orders,
    takeaway_item_notes_allowed: b.takeaway_item_notes_allowed,
    takeaway_scheduled_orders_allowed: b.takeaway_scheduled_orders_allowed,
  }
}

/**
 * Business rules for an ordering-settings save payload. Returns the first
 * violation found (deterministic check order) as a single { code, message },
 * or null when the payload is fully valid. Server callers must pass a
 * FRESHLY reloaded `context` — never the client's copy of
 * `service_takeaway_enabled`.
 */
export function validateOrderingPayload(
  payload: OrderingPayload,
  context: OrderingValidationContext,
): OrderingError | null {
  if (!context.serviceTakeawayEnabled) {
    return { code: 'takeaway_not_enabled', message: 'Takeaway is not enabled for this restaurant.' }
  }

  if (!(PREP_TIME_OPTIONS as readonly number[]).includes(payload.takeaway_prep_time_minutes)) {
    return { code: 'prep_time_invalid', message: 'Invalid takeaway_prep_time_minutes.' }
  }
  if (!(SLOT_INTERVAL_OPTIONS as readonly number[]).includes(payload.takeaway_slot_interval_minutes)) {
    return { code: 'slot_interval_invalid', message: 'Invalid takeaway_slot_interval_minutes.' }
  }
  if (payload.takeaway_min_order_cents < 0) {
    return { code: 'min_order_negative', message: 'takeaway_min_order_cents cannot be negative.' }
  }
  if (payload.takeaway_min_order_cents > MIN_ORDER_CENTS_MAX) {
    return { code: 'min_order_too_high', message: 'takeaway_min_order_cents is too high.' }
  }

  return null
}
