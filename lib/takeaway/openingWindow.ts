// lib/takeaway/openingWindow.ts
//
// Compute takeaway availability for a restaurant, right now.
//
// Returns one of three shapes:
//   - open_now: takeaway accepting orders; earliestPickupInstant is a real ISO datetime.
//   - closed_today: no more windows today, but a future window exists within 7 days.
//   - unavailable: no opening window in the next 7 days OR service disabled.
//
// This is READ-ONLY. Never trust for a write path — the submit endpoint in
// C6.3 will re-check. The purpose here is purely to gate T0's UI copy and
// the initial "earliest pickup" hint on T1's sticky footer.
//
// Timezone: Netherlands is Europe/Amsterdam. "Today"/day-of-week and wall
// clock are computed in that zone regardless of server clock (UTC on
// Vercel), via Intl.DateTimeFormat round-trips — mirrors the pattern in
// lib/booking/openingHours.ts (same service_scope filter idea, 'takeaway'
// instead of 'reservations').

import 'server-only'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'

const TZ = 'Europe/Amsterdam'

type AvailabilityRow = {
  day_of_week: number // 1=Mon .. 7=Sun (ISO)
  open_time: string // 'HH:MM:SS'
  close_time: string
  closes_next_day: boolean
  is_active: boolean
  service_scope: string
}

export type OpeningWindowResult =
  | {
      status: 'open_now'
      earliestPickupInstant: string // ISO
      todayCloseInstant: string // ISO
      slotIntervalMinutes: number
      prepTimeMinutes: number
    }
  | {
      status: 'closed_today'
      nextOpenInstant: string
      nextCloseInstant: string
      slotIntervalMinutes: number
      prepTimeMinutes: number
    }
  | {
      status: 'unavailable'
      reason: 'service_disabled' | 'not_accepting_orders' | 'no_upcoming_hours'
    }

type RestaurantConfig = {
  serviceTakeawayEnabled: boolean
  takeawayAcceptingOrders: boolean
  hoursPerServiceOverride: boolean
  prepTimeMinutes: number
  slotIntervalMinutes: number
}

const DEFAULT_PREP_TIME_MIN = 25
const DEFAULT_SLOT_INTERVAL_MIN = 15
const LOOKAHEAD_DAYS = 7

export async function computeTakeawayOpeningWindow(
  restaurantId: string,
  now: Date = new Date(),
): Promise<OpeningWindowResult> {
  const admin = await createSupabaseServerClientAdmin()

  const { data: r, error: rErr } = await admin
    .from('restaurants')
    .select(
      'service_takeaway_enabled, takeaway_accepting_orders, hours_per_service_override, takeaway_prep_time_minutes, takeaway_slot_interval_minutes',
    )
    .eq('id', restaurantId)
    .maybeSingle()

  if (rErr || !r) {
    return { status: 'unavailable', reason: 'service_disabled' }
  }

  const cfg: RestaurantConfig = {
    serviceTakeawayEnabled: !!r.service_takeaway_enabled,
    takeawayAcceptingOrders: !!r.takeaway_accepting_orders,
    hoursPerServiceOverride: !!r.hours_per_service_override,
    prepTimeMinutes: r.takeaway_prep_time_minutes ?? DEFAULT_PREP_TIME_MIN,
    slotIntervalMinutes: r.takeaway_slot_interval_minutes ?? DEFAULT_SLOT_INTERVAL_MIN,
  }

  if (!cfg.serviceTakeawayEnabled) {
    return { status: 'unavailable', reason: 'service_disabled' }
  }
  if (!cfg.takeawayAcceptingOrders) {
    return { status: 'unavailable', reason: 'not_accepting_orders' }
  }

  const scopeFilter = cfg.hoursPerServiceOverride ? ['all', 'takeaway'] : ['all']

  const { data: rows, error: aErr } = await admin
    .from('availability')
    .select('day_of_week, open_time, close_time, closes_next_day, is_active, service_scope')
    .eq('restaurant_id', restaurantId)
    .eq('is_active', true)
    .in('service_scope', scopeFilter)
    .returns<AvailabilityRow[]>()

  if (aErr) {
    console.error('[computeTakeawayOpeningWindow] availability load failed', aErr.message)
    return { status: 'unavailable', reason: 'no_upcoming_hours' }
  }

  const availabilityRows = rows ?? []
  if (availabilityRows.length === 0) {
    return { status: 'unavailable', reason: 'no_upcoming_hours' }
  }

  // Build a per-day-of-week lookup. Prefer 'takeaway' scope over 'all' when both exist.
  const perDay = new Map<number, AvailabilityRow>()
  for (const row of availabilityRows) {
    const existing = perDay.get(row.day_of_week)
    if (!existing) {
      perDay.set(row.day_of_week, row)
    } else if (row.service_scope === 'takeaway' && existing.service_scope !== 'takeaway') {
      perDay.set(row.day_of_week, row)
    }
  }

  // Local (Amsterdam) view of "now".
  const local = amsterdamPartsOf(now)
  const todayIsoDow = local.isoDow

  // Try today first.
  const todayRow = perDay.get(todayIsoDow)
  if (todayRow) {
    const { openInstant, closeInstant } = rowToInstants(todayRow, local, 0)
    const earliestFromNow = new Date(now.getTime() + cfg.prepTimeMinutes * 60_000)
    // If we can fit a pickup before close, we're open now.
    const earliestConsidered =
      earliestFromNow.getTime() < openInstant.getTime() ? openInstant : earliestFromNow
    const rounded = roundUpToInterval(earliestConsidered, cfg.slotIntervalMinutes)

    if (rounded.getTime() < closeInstant.getTime()) {
      return {
        status: 'open_now',
        earliestPickupInstant: rounded.toISOString(),
        todayCloseInstant: closeInstant.toISOString(),
        slotIntervalMinutes: cfg.slotIntervalMinutes,
        prepTimeMinutes: cfg.prepTimeMinutes,
      }
    }
  }

  // Scan the next 7 days.
  for (let addDays = 1; addDays <= LOOKAHEAD_DAYS; addDays++) {
    const futureIsoDow = ((todayIsoDow - 1 + addDays) % 7) + 1
    const row = perDay.get(futureIsoDow)
    if (!row) continue
    const { openInstant, closeInstant } = rowToInstants(row, local, addDays)
    return {
      status: 'closed_today',
      nextOpenInstant: openInstant.toISOString(),
      nextCloseInstant: closeInstant.toISOString(),
      slotIntervalMinutes: cfg.slotIntervalMinutes,
      prepTimeMinutes: cfg.prepTimeMinutes,
    }
  }

  return { status: 'unavailable', reason: 'no_upcoming_hours' }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

type AmsterdamParts = {
  isoDow: number // 1=Mon .. 7=Sun
  yearMonthDay: string // 'YYYY-MM-DD' in Amsterdam local
  hour: number
  minute: number
}

function amsterdamPartsOf(d: Date): AmsterdamParts {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false,
  })
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value])) as Record<
    string,
    string
  >

  const shortDow = parts.weekday // e.g. 'Mon'
  const map: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }
  return {
    isoDow: map[shortDow] ?? 1,
    yearMonthDay: `${parts.year}-${parts.month}-${parts.day}`,
    hour: parseInt(parts.hour, 10),
    minute: parseInt(parts.minute, 10),
  }
}

/**
 * Convert an availability row + a target local date to concrete UTC instants.
 * `addDaysFromToday` is 0 for today, 1 for tomorrow, etc. — the local date
 * is derived from the current Amsterdam local date + addDays.
 */
function rowToInstants(
  row: AvailabilityRow,
  todayLocal: AmsterdamParts,
  addDaysFromToday: number,
): { openInstant: Date; closeInstant: Date } {
  const baseYmd = addDaysToYmd(todayLocal.yearMonthDay, addDaysFromToday)
  const openInstant = amsterdamWallClockToUtc(baseYmd, row.open_time)
  const closeYmd = row.closes_next_day ? addDaysToYmd(baseYmd, 1) : baseYmd
  const closeInstant = amsterdamWallClockToUtc(closeYmd, row.close_time)
  return { openInstant, closeInstant }
}

function addDaysToYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map((s) => parseInt(s, 10))
  const dt = new Date(Date.UTC(y!, m! - 1, d!))
  dt.setUTCDate(dt.getUTCDate() + days)
  const ny = dt.getUTCFullYear()
  const nm = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const nd = String(dt.getUTCDate()).padStart(2, '0')
  return `${ny}-${nm}-${nd}`
}

/**
 * Given a local Amsterdam wall-clock date and time-of-day, return the UTC
 * instant. Handles the two DST transitions correctly by looking up the actual
 * offset via a formatter round-trip.
 */
function amsterdamWallClockToUtc(ymd: string, hhmmss: string): Date {
  const [hh, mm, ss] = hhmmss.split(':').map((s) => parseInt(s, 10))
  const utcGuess = new Date(
    `${ymd}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss ?? 0).padStart(2, '0')}.000Z`,
  )
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
  const parts = Object.fromEntries(fmt.formatToParts(utcGuess).map((p) => [p.type, p.value])) as Record<
    string,
    string
  >
  const asIfLocal = new Date(
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00.000Z`,
  )
  const offsetMs = asIfLocal.getTime() - utcGuess.getTime()
  return new Date(utcGuess.getTime() - offsetMs)
}

function roundUpToInterval(d: Date, intervalMinutes: number): Date {
  const ms = intervalMinutes * 60_000
  return new Date(Math.ceil(d.getTime() / ms) * ms)
}
