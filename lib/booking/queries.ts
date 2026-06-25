// lib/booking/queries.ts
//
// loadAvailabilityInputs() — the data layer for the availability engine.
//
// One call returns: opening windows for the date, all bookable zones+tables,
// and all active bookings whose occupancy could overlap the date (with a
// turnover-buffer halo on either side).
//
// Server-side only. Uses the admin client because public RLS hides bookings
// from anonymous callers; the result is consumed by `computeAvailability`
// and never sent raw to the client.

import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import type {
  AvailabilityInputs,
  BookableTable,
  BookableZone,
  BookingConfig,
  ExistingBooking,
  OpeningWindow,
} from './types';

/* -------------------------------------------------------------------------- */
/*  Timezone helpers (Europe/Amsterdam, civil-time aware)                     */
/* -------------------------------------------------------------------------- */

const RESTAURANT_TZ = 'Europe/Amsterdam';

/**
 * Compute the absolute UTC instant for a wall-clock (YYYY-MM-DD, HH:MM:SS)
 * in Europe/Amsterdam. Handles DST correctly by probing the UTC offset at the
 * candidate instant. The DST gap (one civil hour per year that doesn't exist)
 * is resolved by snapping forward; the DST overlap (one civil hour that exists
 * twice) is resolved by picking the earlier instance. Opening hours never fall
 * inside DST gaps in practice (transitions happen at 02:00/03:00 local), so
 * these edge cases are guard-rails, not load-bearing logic.
 */
export function amsterdamWallClockToUtc(dateLocal: string, time: string): Date {
  const [y, m, d] = dateLocal.split('-').map(Number);
  const [hh, mm, ss = '0'] = time.split(':');
  const targetMinutesUtc = Date.UTC(y, m - 1, d, Number(hh), Number(mm), Number(ss));

  // Iterate: assume the offset is the offset at `targetMinutesUtc - guess`.
  // Two passes converge for both DST states.
  let guess = new Date(targetMinutesUtc);
  for (let i = 0; i < 2; i++) {
    const offsetMin = amsterdamOffsetMinutes(guess);
    guess = new Date(targetMinutesUtc - offsetMin * 60_000);
  }
  return guess;
}

/**
 * Offset of Europe/Amsterdam from UTC, in minutes, at the given instant.
 * CET = +60, CEST = +120.
 */
function amsterdamOffsetMinutes(instant: Date): number {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: RESTAURANT_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(instant).reduce<Record<string, string>>((acc, p) => {
    if (p.type !== 'literal') acc[p.type] = p.value;
    return acc;
  }, {});
  const wallUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour === '24' ? '0' : parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return Math.round((wallUtc - instant.getTime()) / 60_000);
}

/**
 * ISO day-of-week (Mon=1, Sun=7) for a Europe/Amsterdam civil date.
 */
export function isoDayOfWeekForLocalDate(dateLocal: string): number {
  const [y, m, d] = dateLocal.split('-').map(Number);
  // Use Date.UTC to avoid local-tz drift; the day-of-week of a YYYY-MM-DD is
  // the same in any timezone treated as wall-clock (it's a civil-date concept).
  const utc = new Date(Date.UTC(y, m - 1, d));
  const jsDay = utc.getUTCDay(); // 0=Sun..6=Sat
  return jsDay === 0 ? 7 : jsDay;
}

/**
 * The Europe/Amsterdam civil date one day after `dateLocal`.
 */
export function nextLocalDate(dateLocal: string): string {
  const [y, m, d] = dateLocal.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + 1);
  return utc.toISOString().slice(0, 10);
}

/* -------------------------------------------------------------------------- */
/*  Raw row shapes (match live DB exactly)                                    */
/* -------------------------------------------------------------------------- */

interface RawAvailabilityRow {
  id: string;
  day_of_week: number;
  service_scope: string;
  open_time: string;
  close_time: string;
  closes_next_day: boolean;
  is_active: boolean;
  tag_brunch: boolean;
  tag_lunch: boolean;
  tag_dinner: boolean;
}

interface RawZoneRow {
  id: string;
  name: string;
  display_order: number;
}

interface RawTableRow {
  id: string;
  zone_id: string;
  label: string;
  seats: number;
}

interface RawBookingRow {
  id: string;
  party_size: number;
  zone_id: string | null;
  slot_time: string;
  duration_minutes: number;
  status: 'pending' | 'confirmed' | 'attended';
}

interface RawBookingTableRow {
  booking_id: string;
  table_id: string;
}

/* -------------------------------------------------------------------------- */
/*  Public API                                                                */
/* -------------------------------------------------------------------------- */

/**
 * Load every input the availability compute function needs for one
 * (restaurant, date, partySize) combination.
 *
 * Pure data fetch — no logic, no slot generation, no conflict resolution.
 * Those live in `computeAvailability` (C4.1B).
 *
 * @param config  Loaded BookingConfig (provides restaurantId and feature flags).
 * @param dateLocal ISO date YYYY-MM-DD interpreted in Europe/Amsterdam.
 * @returns AvailabilityInputs ready to feed into computeAvailability.
 */
export async function loadAvailabilityInputs(
  config: BookingConfig,
  dateLocal: string,
): Promise<AvailabilityInputs> {
  const supabase = await createSupabaseServerClientAdmin();
  const isoDay = isoDayOfWeekForLocalDate(dateLocal);

  /* ------------------------------------------------------------------ */
  /*  1. Opening windows                                                */
  /* ------------------------------------------------------------------ */

  const scopeFilter = config.hoursPerServiceOverride
    ? ['all', 'reservations']
    : ['all'];

  const { data: hoursRows, error: hoursErr } = await supabase
    .from('availability')
    .select(
      'id, day_of_week, service_scope, open_time, close_time, closes_next_day, is_active, tag_brunch, tag_lunch, tag_dinner',
    )
    .eq('restaurant_id', config.restaurantId)
    .eq('day_of_week', isoDay)
    .eq('is_active', true)
    .in('service_scope', scopeFilter)
    .returns<RawAvailabilityRow[]>();

  if (hoursErr) {
    console.error('[booking/queries] hours load failed', { code: hoursErr.code });
  }

  const windows: OpeningWindow[] = (hoursRows ?? []).map((row) => {
    const openInstant = amsterdamWallClockToUtc(dateLocal, row.open_time);
    const closeDate = row.closes_next_day ? nextLocalDate(dateLocal) : dateLocal;
    const closeInstant = amsterdamWallClockToUtc(closeDate, row.close_time);
    return {
      id: row.id,
      openInstant,
      closeInstant,
      closesNextDay: row.closes_next_day,
      serviceScope: row.service_scope,
      tags: {
        brunch: row.tag_brunch,
        lunch: row.tag_lunch,
        dinner: row.tag_dinner,
      },
    };
  });

  // Sort by openInstant ascending so downstream slot generation is deterministic.
  windows.sort((a, b) => a.openInstant.getTime() - b.openInstant.getTime());

  /* ------------------------------------------------------------------ */
  /*  2. Zones + tables                                                 */
  /* ------------------------------------------------------------------ */

  const { data: zoneRows, error: zonesErr } = await supabase
    .from('zones')
    .select('id, name, display_order')
    .eq('restaurant_id', config.restaurantId)
    .is('deleted_at', null)
    .order('display_order', { ascending: true })
    .returns<RawZoneRow[]>();

  if (zonesErr) {
    console.error('[booking/queries] zones load failed', { code: zonesErr.code });
  }

  const zoneIds = (zoneRows ?? []).map((z) => z.id);

  let tableRows: RawTableRow[] = [];
  if (zoneIds.length > 0) {
    const { data: rows, error: tablesErr } = await supabase
      .from('restaurant_tables')
      .select('id, zone_id, label, seats')
      .eq('restaurant_id', config.restaurantId)
      .is('deleted_at', null)
      .eq('is_bookable', true)
      .in('zone_id', zoneIds)
      .returns<RawTableRow[]>();
    if (tablesErr) {
      console.error('[booking/queries] tables load failed', { code: tablesErr.code });
    }
    tableRows = rows ?? [];
  }

  const tablesByZone = new Map<string, BookableTable[]>();
  for (const row of tableRows) {
    const arr = tablesByZone.get(row.zone_id) ?? [];
    arr.push({ id: row.id, zoneId: row.zone_id, label: row.label, seats: row.seats });
    tablesByZone.set(row.zone_id, arr);
  }

  const zones: BookableZone[] = (zoneRows ?? []).map((z) => ({
    id: z.id,
    name: z.name,
    displayOrder: z.display_order,
    tables: (tablesByZone.get(z.id) ?? []).sort(
      (a, b) => a.seats - b.seats || a.label.localeCompare(b.label),
    ),
  }));

  /* ------------------------------------------------------------------ */
  /*  3. Existing active bookings on the date (+ turnover-buffer halo)  */
  /* ------------------------------------------------------------------ */

  // Halo: load any booking whose slot_time falls within a generous window
  // around `dateLocal` so the compute layer can detect conflicts that bleed
  // across midnight (e.g. 23:30 booking on day N still occupies tables into
  // day N+1). 36 hours each side is overkill-safe vs. any realistic duration.
  const HALO_HOURS = 36;
  const dayStartLocalUtc = amsterdamWallClockToUtc(dateLocal, '00:00:00');
  const dayEndLocalUtc = amsterdamWallClockToUtc(nextLocalDate(dateLocal), '00:00:00');
  const fromInstant = new Date(dayStartLocalUtc.getTime() - HALO_HOURS * 3600_000);
  const toInstant = new Date(dayEndLocalUtc.getTime() + HALO_HOURS * 3600_000);

  const { data: bookingRows, error: bookingsErr } = await supabase
    .from('bookings')
    .select('id, party_size, zone_id, slot_time, duration_minutes, status')
    .eq('restaurant_id', config.restaurantId)
    .in('status', ['pending', 'confirmed', 'attended'])
    .gte('slot_time', fromInstant.toISOString())
    .lt('slot_time', toInstant.toISOString())
    .returns<RawBookingRow[]>();

  if (bookingsErr) {
    console.error('[booking/queries] bookings load failed', { code: bookingsErr.code });
  }

  const bookingIds = (bookingRows ?? []).map((b) => b.id);
  let btRows: RawBookingTableRow[] = [];
  if (bookingIds.length > 0) {
    const { data: rows, error: btErr } = await supabase
      .from('booking_tables')
      .select('booking_id, table_id')
      .in('booking_id', bookingIds)
      .returns<RawBookingTableRow[]>();
    if (btErr) {
      console.error('[booking/queries] booking_tables load failed', { code: btErr.code });
    }
    btRows = rows ?? [];
  }

  const tablesByBooking = new Map<string, string[]>();
  for (const row of btRows) {
    const arr = tablesByBooking.get(row.booking_id) ?? [];
    arr.push(row.table_id);
    tablesByBooking.set(row.booking_id, arr);
  }

  const existingBookings: ExistingBooking[] = (bookingRows ?? []).map((b) => ({
    id: b.id,
    partySize: b.party_size,
    zoneId: b.zone_id,
    slotInstant: new Date(b.slot_time),
    durationMinutes: b.duration_minutes,
    status: b.status,
    tableIds: tablesByBooking.get(b.id) ?? [],
  }));

  return {
    dateLocal,
    isoDayOfWeek: isoDay,
    windows,
    zones,
    existingBookings,
  };
}
