// lib/dashboard/settings/notificationsValidation.ts
//
// Shared notifications-payload validation, imported by BOTH the client
// form and the mutating route — same posture as businessValidation.ts.
// No uniqueness checks, no format regexes: four required booleans, no
// defaults (every save must state all four explicitly).

export type NotificationsPayload = {
  notify_booking_confirmed: boolean
  notify_booking_cancelled: boolean
  notify_order_confirmed: boolean
  notify_order_ready: boolean
}

/**
 * Parse an untrusted request body into a NotificationsPayload shape.
 * Returns null when the body isn't even shaped like one — callers
 * answer 400 invalid_body.
 */
export function parseNotificationsPayload(raw: unknown): NotificationsPayload | null {
  if (typeof raw !== 'object' || raw === null) return null
  const b = raw as Record<string, unknown>

  if (typeof b.notify_booking_confirmed !== 'boolean') return null
  if (typeof b.notify_booking_cancelled !== 'boolean') return null
  if (typeof b.notify_order_confirmed !== 'boolean') return null
  if (typeof b.notify_order_ready !== 'boolean') return null

  return {
    notify_booking_confirmed: b.notify_booking_confirmed,
    notify_booking_cancelled: b.notify_booking_cancelled,
    notify_order_confirmed: b.notify_order_confirmed,
    notify_order_ready: b.notify_order_ready,
  }
}
