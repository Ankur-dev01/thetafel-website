/**
 * Shared (non-server-only) types for the Reserveringen list — usable from
 * both the server query layer (lib/dashboard/queries/bookings.ts) and client
 * components (grouping/filtering logic runs client-side on the already-
 * fetched day's bookings).
 */

export type BookingStatus = 'pending' | 'confirmed' | 'attended' | 'cancelled' | 'no_show'
export type BookingSource = 'online' | 'walk_in' | 'phone'
export type DepositState = 'none' | 'paid' | 'pending'

export type DayBooking = {
  id: string
  slot_time: string
  party_size: number
  status: BookingStatus
  source: BookingSource
  duration_minutes: number
  guest_note: string | null
  attended_at: string | null
  guest_name: string
  guest_phone: string | null
  zone_name: string | null
  table_labels: string[]
  deposit_state: DepositState
  deposit_amount_cents: number | null
  /** Raw payment_intents.status for the deposit intent, or null if none/never created. Used by the "payment failed" filter chip. */
  deposit_intent_status: string | null
}

/**
 * A bookable window for one civil day. `tag_lunch`/`tag_dinner`/`tag_brunch`
 * are independent booleans on the live `availability` row — a single window
 * can (and, for the current test/fixture restaurant, does) carry more than
 * one tag at once (e.g. an 11:00–22:00 block tagged both lunch AND dinner).
 * There is no single "service_tag" per window in the live schema, so group
 * assignment for a given booking happens in `resolveServiceGroup`, which
 * splits a multi-tagged window at a conventional dinner-start hour rather
 * than pretending each window has exactly one tag.
 */
export type ServiceWindow = {
  scope: 'reservations' | 'takeaway' | 'qr' | 'all'
  tag_lunch: boolean
  tag_dinner: boolean
  tag_brunch: boolean
  open_local: string // 'HH:MM' Amsterdam
  close_local: string // 'HH:MM' Amsterdam
  open_utc: string
  close_utc: string
}

export type ServiceGroupKey = 'brunch' | 'lunch' | 'dinner' | 'other'
