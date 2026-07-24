import 'server-only'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  amsterdamWallClockToUtc,
  isoDayOfWeekForLocalDate,
  nextLocalDate,
} from '@/lib/booking/queries'
import { amsterdamDayBoundsUtc } from '@/lib/dashboard/date/amsterdamDay'
import { isWhatsAppEnabled } from '@/lib/consumer/whatsapp/send'
import type {
  DayBooking,
  DepositState,
  ServiceWindow,
  BookingStatus,
  BookingSource,
  BookingDetailPayload,
  DepositDeliveryState,
  EmailDeliveryState,
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
export type {
  DayBooking,
  ServiceWindow,
  ServiceGroupKey,
  BookingDetailPayload,
} from '@/lib/dashboard/bookings/types'
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
  guest: { id: string; full_name: string | null; phone: string | null; anonymised_at: string | null } | null
  zone: { name: string | null } | null
  booking_tables: { restaurant_tables: { label: string | null } | null }[] | null
}

const BOOKING_SELECT = `id, slot_time, party_size, status, source, duration_minutes, guest_note, attended_at,
       deposit_amount_cents, deposit_intent_id,
       guest:guests(id, full_name, phone, anonymised_at),
       zone:zones(name),
       booking_tables(restaurant_tables(label))`

function toDayBooking(row: BookingJoinRow, intentStatusById: Map<string, string>): DayBooking {
  let depositState: DepositState = 'none'
  let depositIntentStatus: string | null = null
  if (row.deposit_amount_cents !== null && row.deposit_amount_cents > 0) {
    depositIntentStatus =
      row.deposit_intent_id !== null ? intentStatusById.get(row.deposit_intent_id) ?? null : null
    depositState = depositIntentStatus === 'paid' ? 'paid' : 'pending'
  }

  const anonymised = row.guest?.anonymised_at !== null && row.guest?.anonymised_at !== undefined

  return {
    id: row.id,
    slot_time: row.slot_time,
    party_size: row.party_size,
    status: row.status,
    source: row.source,
    duration_minutes: row.duration_minutes,
    guest_note: row.guest_note,
    attended_at: row.attended_at,
    guest_name: anonymised ? '' : row.guest?.full_name ?? '',
    guest_phone: anonymised ? null : row.guest?.phone ?? null,
    guest_anonymised: anonymised,
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
    .select(BOOKING_SELECT)
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
    .select(BOOKING_SELECT)
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

// ---------------------------------------------------------------------------
// D2.2 — reservation detail depth
// ---------------------------------------------------------------------------

/**
 * Real consumer_audit_logs event types confirmed against the live table for
 * D2.2 (booking.confirmed / deposit.intent.* do NOT exist — bookings go
 * straight to 'confirmed' with no separate confirmation event, and the
 * deposit flow isn't wired yet per the D6.2 BuildPlan gap).
 */
const CONSUMER_HISTORY_EVENT_TYPES = [
  'booking.create.succeeded',
  'booking.create.replay',
  'booking.cancelled_by_guest',
  'booking.change_requested',
  'booking.ics_downloaded',
  'email.sent',
  'email.send_failed',
  'whatsapp.sent',
  'whatsapp.send_failed',
]

function deriveDepositState(
  depositAmountCents: number | null,
  intentStatus: string | null
): DepositDeliveryState {
  if (depositAmountCents === null || depositAmountCents <= 0) return 'not_required'
  if (intentStatus === null) return 'pending'
  if (intentStatus === 'paid') return 'paid'
  if (intentStatus === 'failed' || intentStatus === 'cancelled') return 'failed'
  if (intentStatus === 'refunded' || intentStatus === 'partially_refunded') return 'refunded'
  return 'pending'
}

type EmailWhatsappSummary = { state: EmailDeliveryState; at: string | null; failureReason: string | null }

function deriveChannelState(
  events: { event_type: string; created_at: string; event_data: Record<string, unknown> }[],
  sentType: string,
  failedType: string
): EmailWhatsappSummary {
  const channelEvents = events
    .filter((e) => e.event_type === sentType || e.event_type === failedType)
    .sort((a, b) => a.created_at.localeCompare(b.created_at))

  if (channelEvents.length === 0) return { state: 'not_sent', at: null, failureReason: null }

  const last = channelEvents[channelEvents.length - 1]
  if (last.event_type === sentType) {
    return { state: 'sent', at: last.created_at, failureReason: null }
  }
  const reason = typeof last.event_data?.error === 'string' ? (last.event_data.error as string) : null
  return { state: 'failed', at: last.created_at, failureReason: reason }
}

/**
 * The expanded reservation-detail payload — D2.2. Every sub-query is
 * restaurant-scoped explicitly (RLS is the belt, this is the braces); the
 * guest-lifetime query is the one that matters most here, since `guests` is
 * a global table and a guest may have dined at other restaurants — those
 * rows must never leak into this restaurant's view.
 */
export async function getBookingDetail(
  restaurantId: string,
  bookingId: string
): Promise<BookingDetailPayload | null> {
  const supabase = await createSupabaseServerClient()

  const { data: bookingRow, error: bookingError } = await supabase
    .from('bookings')
    .select(BOOKING_SELECT)
    .eq('restaurant_id', restaurantId)
    .eq('id', bookingId)
    .maybeSingle()

  if (bookingError) throw bookingError
  if (!bookingRow) return null

  const row = bookingRow as unknown as BookingJoinRow
  const guestId = row.guest?.id ?? null

  const intentStatusById = await fetchIntentStatusMap(
    supabase,
    row.deposit_intent_id ? [row.deposit_intent_id] : []
  )
  const booking = toDayBooking(row, intentStatusById)

  const [guestBookingsResult, guestNoteResult, dashboardLogResult, consumerLogResult] =
    await Promise.all([
      guestId
        ? supabase
            .from('bookings')
            .select('id, slot_time, status')
            .eq('restaurant_id', restaurantId)
            .eq('guest_id', guestId)
        : Promise.resolve({ data: [], error: null }),
      guestId
        ? supabase
            .from('guest_notes')
            .select('note, updated_at, updated_by, staff:restaurant_staff(display_name)')
            .eq('restaurant_id', restaurantId)
            .eq('guest_id', guestId)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase
        .from('dashboard_audit_logs')
        .select('id, event_type, event_data, created_at, staff:restaurant_staff(display_name)')
        .eq('restaurant_id', restaurantId)
        .eq('booking_id', bookingId)
        .order('created_at', { ascending: true }),
      supabase
        .from('consumer_audit_logs')
        .select('id, event_type, event_data, created_at')
        .eq('restaurant_id', restaurantId)
        .eq('booking_id', bookingId)
        .in('event_type', CONSUMER_HISTORY_EVENT_TYPES)
        .order('created_at', { ascending: true }),
    ])

  if (guestBookingsResult.error) throw guestBookingsResult.error
  if (guestNoteResult.error) throw guestNoteResult.error
  if (dashboardLogResult.error) throw dashboardLogResult.error
  if (consumerLogResult.error) throw consumerLogResult.error

  // Guest lifetime summary — ATTENDED visits only, this restaurant. An
  // "attended" reading answers "how many times has this guest actually
  // dined here", not "how many rows exist" (pending/cancelled don't count
  // as having dined). The booking being viewed counts only if it's itself
  // attended, and is always excluded from "last completed visit" so a
  // just-arrived guest doesn't show themselves as their own last visit.
  const guestBookings = (guestBookingsResult.data ?? []) as { id: string; slot_time: string; status: string }[]
  const attendedBookings = guestBookings.filter((b) => b.status === 'attended')
  const priorAttendedBookings = attendedBookings.filter((b) => b.id !== bookingId)

  const visitsCount = attendedBookings.length
  const firstVisitAt =
    attendedBookings.length > 0
      ? attendedBookings.reduce((min, b) => (b.slot_time < min ? b.slot_time : min), attendedBookings[0].slot_time)
      : null
  const lastCompletedVisitAt =
    priorAttendedBookings.length > 0
      ? priorAttendedBookings.reduce((max, b) => (b.slot_time > max ? b.slot_time : max), priorAttendedBookings[0].slot_time)
      : null
  const noShowCount = guestBookings.filter((b) => b.status === 'no_show').length

  const guestSummary: BookingDetailPayload['guestSummary'] = {
    visitsCount,
    firstVisitAt,
    lastCompletedVisitAt,
    noShowCount,
  }

  const noteRow = guestNoteResult.data as
    | { note: string; updated_at: string; updated_by: string | null; staff: { display_name: string | null } | null }
    | null
  const guestNote: BookingDetailPayload['guestNote'] = noteRow
    ? {
        note: noteRow.note,
        updatedAt: noteRow.updated_at,
        updatedByDisplayName: noteRow.staff?.display_name ?? null,
      }
    : null

  type DashboardLogRow = {
    id: string
    event_type: string
    event_data: Record<string, unknown>
    created_at: string
    staff: { display_name: string | null } | null
  }
  type ConsumerLogRow = {
    id: string
    event_type: string
    event_data: Record<string, unknown>
    created_at: string
  }

  const dashboardEntries: BookingDetailPayload['history'] = (
    (dashboardLogResult.data ?? []) as unknown as DashboardLogRow[]
  ).map((r) => ({
    source: 'dashboard' as const,
    id: r.id,
    at: r.created_at,
    eventType: r.event_type,
    eventData: r.event_data ?? {},
    actorDisplayName: r.staff?.display_name ?? null,
  }))

  const consumerRows = (consumerLogResult.data ?? []) as unknown as ConsumerLogRow[]
  const consumerEntries: BookingDetailPayload['history'] = consumerRows.map((r) => ({
    source: 'consumer' as const,
    id: r.id,
    at: r.created_at,
    eventType: r.event_type,
    eventData: r.event_data ?? {},
  }))

  const history = [...dashboardEntries, ...consumerEntries].sort((a, b) => a.at.localeCompare(b.at))

  const emailState = deriveChannelState(consumerRows, 'email.sent', 'email.send_failed')
  const whatsappEnabled = isWhatsAppEnabled()
  const whatsappState = whatsappEnabled
    ? deriveChannelState(consumerRows, 'whatsapp.sent', 'whatsapp.send_failed')
    : null

  const delivery: BookingDetailPayload['delivery'] = {
    depositIntent: {
      state: deriveDepositState(booking.deposit_amount_cents, booking.deposit_intent_status),
      amountCents: booking.deposit_amount_cents,
    },
    confirmationEmail: {
      state: emailState.state,
      at: emailState.at,
      failureReason: emailState.failureReason,
    },
    // TODO: reminder scheduling not shipped (no notification_schedules table
    // yet) — state stays dormant until that lands.
    reminder: { state: 'not_scheduled', at: null },
    whatsapp: whatsappEnabled
      ? { state: whatsappState!.state === 'sent' ? 'sent' : whatsappState!.state === 'failed' ? 'failed' : 'not_sent', at: whatsappState!.at }
      : { state: 'disabled', at: null },
  }

  return { booking, guestSummary, guestNote, history, delivery }
}
