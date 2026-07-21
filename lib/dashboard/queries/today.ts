import 'server-only'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { amsterdamWallClockToUtc, nextLocalDate } from '@/lib/booking/queries'

/**
 * Server-side query helpers for the Vandaag (Today) page. All use the
 * session client so RLS applies; never the admin client.
 *
 * "Today" is the restaurant-local (Europe/Amsterdam) calendar day, computed
 * from the server clock at request time — never the client clock.
 */

// ---------------------------------------------------------------------------
// Amsterdam civil-date helper
// ---------------------------------------------------------------------------

/**
 * "YYYY-MM-DD" civil date in Europe/Amsterdam for the given instant.
 * Duplicated from computeAvailability.ts's private `localDateInAmsterdam`
 * (three lines; not worth threading an export change through its callers
 * for this one extra caller).
 */
function amsterdamCivilDate(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
}

/** [startOfTodayUtcIso, startOfTomorrowUtcIso) for the restaurant-local day containing `now`. */
function todayBoundsUtc(now: Date): [string, string] {
  const todayLocal = amsterdamCivilDate(now)
  const start = amsterdamWallClockToUtc(todayLocal, '00:00:00')
  const end = amsterdamWallClockToUtc(nextLocalDate(todayLocal), '00:00:00')
  return [start.toISOString(), end.toISOString()]
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TodayBookingStatus = 'pending' | 'confirmed' | 'attended'
export type TodayBookingSource = 'online' | 'walk_in' | 'phone'

export type TodayBooking = {
  id: string
  slot_time: string
  party_size: number
  status: TodayBookingStatus
  source: TodayBookingSource
  duration_minutes: number
  guest_note: string | null
  attended_at: string | null
  guest_name: string
  guest_phone: string | null
  zone_name: string | null
  table_labels: string[]
}

export type TodayOrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'completed'
  | 'cancelled'
  | 'refunded'

export type TodayOrder = {
  id: string
  order_ref: string
  order_type: 'qr' | 'takeaway'
  status: TodayOrderStatus
  payment_status: string
  total_cents: number
  pickup_time: string | null
  created_at: string
  table_id: string | null
  tab_id: string | null
  guest_name: string | null
  ready_notified_at: string | null
}

export type TodayAlert = {
  id: string
  tone: 'warning' | 'danger' | 'success' | 'neutral'
  label: string
  actionHref?: string
  actionLabel?: string
}

export type TodayPayload = {
  tiles: {
    bookings: { count: number; covers: number }
    orders: { count: number; revenue_cents: number }
    open_tabs: { count: number; total_cents: number }
    expected_guests: { covers: number }
  }
  bookings: TodayBooking[]
  orders: TodayOrder[]
  now_iso: string
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const TIMELINE_BOOKING_STATUSES: TodayBookingStatus[] = ['pending', 'confirmed', 'attended']
const ORDER_TILE_STATUSES: TodayOrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'served',
]

type BookingJoinRow = {
  id: string
  slot_time: string
  party_size: number
  status: TodayBookingStatus
  source: TodayBookingSource
  duration_minutes: number
  guest_note: string | null
  attended_at: string | null
  guest: { full_name: string | null; phone: string | null } | null
  zone: { name: string | null } | null
  booking_tables: { restaurant_tables: { label: string | null } | null }[] | null
}

export async function getTodayBookings(
  restaurantId: string,
  now: Date = new Date()
): Promise<TodayBooking[]> {
  const supabase = await createSupabaseServerClient()
  const [start, end] = todayBoundsUtc(now)

  const { data, error } = await supabase
    .from('bookings')
    .select(
      `id, slot_time, party_size, status, source, duration_minutes, guest_note, attended_at,
       guest:guests(full_name, phone),
       zone:zones(name),
       booking_tables(restaurant_tables(label))`
    )
    .eq('restaurant_id', restaurantId)
    .gte('slot_time', start)
    .lt('slot_time', end)
    .in('status', TIMELINE_BOOKING_STATUSES)
    .order('slot_time', { ascending: true })

  if (error) throw error

  return ((data ?? []) as unknown as BookingJoinRow[]).map((row) => ({
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
  }))
}

type OrderJoinRow = {
  id: string
  order_ref: string
  order_type: 'qr' | 'takeaway'
  status: TodayOrderStatus
  payment_status: string
  total_cents: number
  pickup_time: string | null
  created_at: string
  table_id: string | null
  tab_id: string | null
  ready_notified_at: string | null
  guest: { full_name: string | null } | null
}

export async function getTodayOrders(
  restaurantId: string,
  now: Date = new Date()
): Promise<TodayOrder[]> {
  const supabase = await createSupabaseServerClient()
  const [start, end] = todayBoundsUtc(now)

  const { data, error } = await supabase
    .from('orders')
    .select(
      `id, order_ref, order_type, status, payment_status, total_cents, pickup_time, created_at,
       table_id, tab_id, ready_notified_at,
       guest:guests(full_name)`
    )
    .eq('restaurant_id', restaurantId)
    .or(
      `and(created_at.gte.${start},created_at.lt.${end}),and(pickup_time.gte.${start},pickup_time.lt.${end})`
    )
    .order('created_at', { ascending: false })

  if (error) throw error

  return ((data ?? []) as unknown as OrderJoinRow[]).map((row) => ({
    id: row.id,
    order_ref: row.order_ref,
    order_type: row.order_type,
    status: row.status,
    payment_status: row.payment_status,
    total_cents: row.total_cents,
    pickup_time: row.pickup_time,
    created_at: row.created_at,
    table_id: row.table_id,
    tab_id: row.tab_id,
    guest_name: row.guest?.full_name ?? null,
    ready_notified_at: row.ready_notified_at,
  }))
}

export async function getOpenTabs(
  restaurantId: string
): Promise<{ count: number; total_cents: number }> {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase
    .from('tabs')
    .select('id, total_cents')
    .eq('restaurant_id', restaurantId)
    .eq('status', 'open')

  if (error) throw error

  const rows = data ?? []
  return {
    count: rows.length,
    total_cents: rows.reduce((sum, r) => sum + r.total_cents, 0),
  }
}

/**
 * Pure function — derives "Verwachte gasten" from the already-fetched
 * booking list rather than a second DB round-trip. Sums party_size across
 * bookings still ahead of `now` with a non-terminal status.
 */
export function getVerwachteGasten(todayBookings: TodayBooking[], now: Date): number {
  return todayBookings
    .filter(
      (b) =>
        new Date(b.slot_time) >= now &&
        (b.status === 'pending' || b.status === 'confirmed')
    )
    .reduce((sum, b) => sum + b.party_size, 0)
}

/** Alert queries land in D1.2 — empty until then. */
export async function getTodayAlerts(restaurantId: string): Promise<TodayAlert[]> {
  void restaurantId
  return []
}

export async function getTodayPayload(
  restaurantId: string,
  now: Date = new Date()
): Promise<TodayPayload> {
  const [bookings, orders, openTabs] = await Promise.all([
    getTodayBookings(restaurantId, now),
    getTodayOrders(restaurantId, now),
    getOpenTabs(restaurantId),
  ])

  const ordersForTiles = orders.filter((o) => ORDER_TILE_STATUSES.includes(o.status))
  const revenueOrders = orders.filter((o) => o.payment_status === 'paid')

  return {
    tiles: {
      bookings: {
        count: bookings.length,
        covers: bookings.reduce((sum, b) => sum + b.party_size, 0),
      },
      orders: {
        count: ordersForTiles.length,
        revenue_cents: revenueOrders.reduce((sum, o) => sum + o.total_cents, 0),
      },
      open_tabs: openTabs,
      expected_guests: { covers: getVerwachteGasten(bookings, now) },
    },
    bookings,
    orders,
    now_iso: now.toISOString(),
  }
}
