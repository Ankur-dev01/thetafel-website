import type { DayBooking } from '@/lib/dashboard/bookings/types'

/**
 * The `?filter=` URL contract for the Reserveringen list. `null` means "Alle"
 * (no param). Shared between FilterChips (for per-chip counts) and
 * BookingsClient (for the actual filtering) so both always agree.
 */
export type BookingFilterKey =
  | 'verwacht'
  | 'aangekomen'
  | 'geannuleerd'
  | 'no_show'
  | 'deposit_pending'
  | 'upcoming'
  | 'payment_failed'

export const BOOKING_FILTER_KEYS: BookingFilterKey[] = [
  'verwacht',
  'aangekomen',
  'geannuleerd',
  'no_show',
  'deposit_pending',
  'upcoming',
  'payment_failed',
]

/** Unknown/garbage `?filter=` values fall back to "Alle" — never a 400. */
export function parseFilterParam(raw: string | undefined | null): BookingFilterKey | null {
  if (!raw) return null
  return (BOOKING_FILTER_KEYS as string[]).includes(raw) ? (raw as BookingFilterKey) : null
}

export function matchesFilter(
  booking: DayBooking,
  filter: BookingFilterKey | null,
  now: Date
): boolean {
  switch (filter) {
    case null:
      return true
    case 'verwacht':
      return booking.status === 'pending' || booking.status === 'confirmed'
    case 'aangekomen':
      return booking.status === 'attended'
    case 'geannuleerd':
      return booking.status === 'cancelled'
    case 'no_show':
      return booking.status === 'no_show'
    case 'deposit_pending':
      return (
        booking.deposit_state === 'pending' &&
        booking.status !== 'cancelled' &&
        booking.status !== 'no_show'
      )
    case 'upcoming':
      return (
        (booking.status === 'pending' || booking.status === 'confirmed') &&
        new Date(booking.slot_time) >= now
      )
    case 'payment_failed':
      return booking.deposit_state === 'pending' && booking.deposit_intent_status === 'failed'
    default:
      return true
  }
}

export function countByFilter(
  bookings: DayBooking[],
  now: Date
): Record<BookingFilterKey, number> {
  const counts = {} as Record<BookingFilterKey, number>
  for (const key of BOOKING_FILTER_KEYS) {
    counts[key] = bookings.filter((b) => matchesFilter(b, key, now)).length
  }
  return counts
}
