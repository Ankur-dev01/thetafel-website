import 'server-only'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  amsterdamWallClockToUtc,
  isoDayOfWeekForLocalDate,
  nextLocalDate,
} from '@/lib/booking/queries'
import { amsterdamDayBoundsUtc } from '@/lib/dashboard/date/amsterdamDay'
import type {
  DayBooking,
  DepositState,
  ServiceWindow,
  BookingStatus,
  BookingSource,
} from '@/lib/dashboard/bookings/types'

/**
 * Booking query helpers for the Reserveringen (Bookings) list page.
 * Session client throughout — RLS scopes every read to the caller's own
 * restaurant.
 *
 * Types (DayBooking, ServiceWindow, ServiceGroupKey) and the pure grouping
 * function (resolveServiceGroup) live in lib/dashboard/bookings/ — NOT here
 * — because this file is `server-only` and BookingsClient (a client
 * component) needs those types and the grouping logic too.
 */
export type { DayBooking, ServiceWindow, ServiceGroupKey } from '@/lib/dashboard/bookings/types'
export { resolveServiceGroup } from '@/lib/dashboard/bookings/serviceGroup'

const RESERVATION_SCOPES = new Set(['all', 'reservations'])

/**
 * Loads the reservation-scope windows for one civil day. An
 * availability_exceptions row (if any, for scope 'all' or 'reservations')
 * overrides the day-of-week availability rows entirely per the D0.1 schema:
 * closed=true → no windows at all; closed=false → the exception's own
 * open/close time is the day's single window (exceptions carry no lunch/
 * dinner/brunch tags, so it's untagged — bookings that day land in "other").
 */
export async function getServiceWindowsForDay(
  restaurantId: string,
  civilDate: string
): Promise<ServiceWindow[]> {
  const supabase = await createSupabaseServerClient()

  const { data: exceptions, error: exceptionsError } = await supabase
    .from('availability_exceptions')
    .select('closed, open_time, close_time, service_scope')
    .eq('restaurant_id', restaurantId)
    .eq('exception_date', civilDate)
    .in('service_scope', ['all', 'reservations'])

  if (exceptionsError) throw exceptionsError

  if (exceptions && exceptions.length > 0) {
    const exception = exceptions[0]
    if (exception.closed || !exception.open_time || !exception.close_time) return []

    const openUtc = amsterdamWallClockToUtc(civilDate, exception.open_time)
    const closeUtc = amsterdamWallClockToUtc(civilDate, exception.close_time)
    return [
      {
        scope: exception.service_scope as ServiceWindow['scope'],
        tag_lunch: false,
        tag_dinner: false,
        tag_brunch: false,
        open_local: exception.open_time.slice(0, 5),
        close_local: exception.close_time.slice(0, 5),
        open_utc: openUtc.toISOString(),
        close_utc: closeUtc.toISOString(),
      },
    ]
  }

  const dayOfWeek = isoDayOfWeekForLocalDate(civilDate)

  const { data: rows, error } = await supabase
    .from('availability')
    .select('service_scope, open_time, close_time, closes_next_day, tag_lunch, tag_dinner, tag_brunch, is_active')
    .eq('restaurant_id', restaurantId)
    .eq('day_of_week', dayOfWeek)
    .eq('is_active', true)

  if (error) throw error

  return (rows ?? [])
    .filter((r) => RESERVATION_SCOPES.has(r.service_scope))
    .map((r) => {
      const closeDate = r.closes_next_day ? nextLocalDate(civilDate) : civilDate
      const openUtc = amsterdamWallClockToUtc(civilDate, r.open_time)
      const closeUtc = amsterdamWallClockToUtc(closeDate, r.close_time)
      return {
        scope: r.service_scope as ServiceWindow['scope'],
        tag_lunch: r.tag_lunch,
        tag_dinner: r.tag_dinner,
        tag_brunch: r.tag_brunch,
        open_local: r.open_time.slice(0, 5),
        close_local: r.close_time.slice(0, 5),
        open_utc: openUtc.toISOString(),
        close_utc: closeUtc.toISOString(),
      }
    })
}

type BookingJoinRow = {
  id: string
  slot_time: string
  party_size: number
  status: BookingStatus
  source: BookingSource
  duration_minutes: number
  guest_note: string | null
  attended_at: string | null
  deposit_amount_cents: number | null
  deposit_intent_id: string | null
  guest: { full_name: string | null; phone: string | null } | null
  zone: { name: string | null } | null
  booking_tables: { restaurant_tables: { label: string | null } | null }[] | null
}

function toDayBooking(row: BookingJoinRow, intentStatusById: Map<string, string>): DayBooking {
  let depositState: DepositState = 'none'
  let depositIntentStatus: string | null = null
  if (row.deposit_amount_cents !== null && row.deposit_amount_cents > 0) {
    depositIntentStatus =
      row.deposit_intent_id !== null ? intentStatusById.get(row.deposit_intent_id) ?? null : null
    depositState = depositIntentStatus === 'paid' ? 'paid' : 'pending'
  }

  return {
    id: row.id,
    slot_time: row.slot_time,
    party_size: row.party_size,
    status: row.status,
    source: row.source,
    duration_minutes: row.duration_minutes,
    guest_note: row.guest_note,
    attended_at: row.attended_at,
    guest_name: row.guest?.full_name ?? '',
    guest_phone: row.guest?.phone ?? null,
    zone_name: row.zone?.name ?? null,
    table_labels: (row.booking_tables ?? [])
      .map((bt) => bt.restaurant_tables?.label)
      .filter((label): label is string => Boolean(label)),
    deposit_state: depositState,
    deposit_amount_cents: row.deposit_amount_cents,
    deposit_intent_status: depositIntentStatus,
  }
}

async function fetchIntentStatusMap(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  intentIds: string[]
): Promise<Map<string, string>> {
  if (intentIds.length === 0) return new Map()
  const { data, error } = await supabase
    .from('payment_intents')
    .select('id, status')
    .in('id', intentIds)
  if (error) throw error
  return new Map((data ?? []).map((i) => [i.id, i.status]))
}

/** All bookings (every status — the caller filters via chips) for one civil day. */
export async function getBookingsForDay(
  restaurantId: string,
  civilDate: string
): Promise<DayBooking[]> {
  const supabase = await createSupabaseServerClient()
  const { startUtc, endUtc } = amsterdamDayBoundsUtc(civilDate)

  const { data, error } = await supabase
    .from('bookings')
    .select(
      `id, slot_time, party_size, status, source, duration_minutes, guest_note, attended_at,
       deposit_amount_cents, deposit_intent_id,
       guest:guests(full_name, phone),
       zone:zones(name),
       booking_tables(restaurant_tables(label))`
    )
    .eq('restaurant_id', restaurantId)
    .gte('slot_time', startUtc)
    .lt('slot_time', endUtc)
    .order('slot_time', { ascending: true })

  if (error) throw error

  const rows = (data ?? []) as unknown as BookingJoinRow[]
  const intentIds = rows
    .map((r) => r.deposit_intent_id)
    .filter((id): id is string => id !== null)

  const intentStatusById = await fetchIntentStatusMap(supabase, intentIds)

  return rows.map((row) => toDayBooking(row, intentStatusById))
}

/** One booking, scoped to `restaurantId` explicitly (RLS is the belt, this is the braces). */
export async function getBookingById(
  restaurantId: string,
  bookingId: string
): Promise<DayBooking | null> {
  const supabase = await createSupabaseServerClient()

  const { data, error } = await supabase
    .from('bookings')
    .select(
      `id, slot_time, party_size, status, source, duration_minutes, guest_note, attended_at,
       deposit_amount_cents, deposit_intent_id,
       guest:guests(full_name, phone),
       zone:zones(name),
       booking_tables(restaurant_tables(label))`
    )
    .eq('restaurant_id', restaurantId)
    .eq('id', bookingId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null

  const row = data as unknown as BookingJoinRow
  const intentStatusById = await fetchIntentStatusMap(
    supabase,
    row.deposit_intent_id ? [row.deposit_intent_id] : []
  )

  return toDayBooking(row, intentStatusById)
}
