// lib/booking/computeAvailability.ts
//
// Pure availability compute. No DB, no network. Given config + already-loaded
// inputs + party + now, returns the slot grid with per-zone capacity.
//
// Test surface: every branch is reachable by varying inputs. The endpoint and
// the dev inspector both call this with real data; future Vitest tests can
// stub `now` and `AvailabilityInputs` to exercise edge cases deterministically.

import type {
  AvailabilityInputs,
  AvailabilityResult,
  AvailabilitySlot,
  BookingConfig,
  ExistingBooking,
  OccupancyDurationMap,
  OpeningWindow,
} from './types';

const FALLBACK_OCCUPANCY_MINUTES = 90;

/* -------------------------------------------------------------------------- */
/*  Public entry point                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Compute the availability grid for a single (restaurant, date, partySize).
 *
 * @param config    Loaded BookingConfig (must be from a live, reservations-on restaurant).
 * @param inputs    Output of `loadAvailabilityInputs(config, dateLocal)`.
 * @param partySize Integer ≥ 1; the engine flags `partyTooLarge` when above max.
 * @param now       Reference instant (default: current). Inject for testability.
 * @returns AvailabilityResult
 */
export function computeAvailability(
  config: BookingConfig,
  inputs: AvailabilityInputs,
  partySize: number,
  now: Date = new Date(),
): AvailabilityResult {
  const occupancyMinutes = resolveOccupancyMinutes(config.occupancyDurationByParty, partySize);

  const skeleton = {
    date: inputs.dateLocal,
    partySize,
    occupancyMinutes,
    slotIntervalMinutes: config.slotIntervalMinutes,
  };

  // 1. Party-size guard.
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > config.maxPartySizeOnline) {
    return {
      ...skeleton,
      closed: false,
      inPast: false,
      beyondWindow: false,
      partyTooLarge: true,
      slots: [],
    };
  }

  // 2. Date-range guards.
  const todayLocal = localDateInAmsterdam(now);
  if (inputs.dateLocal < todayLocal) {
    return {
      ...skeleton,
      closed: false,
      inPast: true,
      beyondWindow: false,
      partyTooLarge: false,
      slots: [],
    };
  }
  const latest = addLocalDays(todayLocal, config.bookingWindowDays);
  if (inputs.dateLocal > latest) {
    return {
      ...skeleton,
      closed: false,
      inPast: false,
      beyondWindow: true,
      partyTooLarge: false,
      slots: [],
    };
  }

  // 3. Closed (no windows).
  if (inputs.windows.length === 0) {
    return {
      ...skeleton,
      closed: true,
      inPast: false,
      beyondWindow: false,
      partyTooLarge: false,
      slots: [],
    };
  }

  // 4. Generate candidate slots from windows, filter by lead time.
  const occupancyMs = occupancyMinutes * 60_000;
  const earliestStartMs = now.getTime() + config.minLeadTimeMinutes * 60_000;
  const candidateStarts = generateCandidateStarts(
    inputs.windows,
    config.slotIntervalMinutes,
    occupancyMs,
    earliestStartMs,
  );

  // 5. For each candidate, compute capacity.
  const bufferMs = config.turnoverBufferMinutes * 60_000;
  const guestCap = config.maxGuestsPerSlot;

  const slots: AvailabilitySlot[] = [];
  for (const startMs of candidateStarts) {
    const endMs = startMs + occupancyMs;

    // 5a. Kitchen-capacity (maxGuestsPerSlot) check — no turnover buffer.
    if (guestCap != null) {
      const guests = guestsOverlapping(inputs.existingBookings, startMs, endMs);
      if (guests + partySize > guestCap) {
        continue;
      }
    }

    // 5b. Per-zone candidate-table accounting.
    let remainingTables = 0;
    let totalCandidates = 0;
    const availableZoneIds: string[] = [];

    for (const zone of inputs.zones) {
      let zoneRemaining = 0;
      let zoneTotal = 0;
      for (const table of zone.tables) {
        if (table.seats < partySize) continue;
        zoneTotal++;
        if (!tableBlockedAt(table.id, startMs, endMs, bufferMs, inputs.existingBookings)) {
          zoneRemaining++;
        }
      }
      totalCandidates += zoneTotal;
      remainingTables += zoneRemaining;
      if (zoneRemaining > 0) availableZoneIds.push(zone.id);
    }

    if (remainingTables === 0) {
      continue;
    }

    slots.push({
      time: amsterdamWallClockTime(new Date(startMs)),
      instant: new Date(startMs).toISOString(),
      availableZoneIds,
      remainingTables,
      totalCandidateTables: totalCandidates,
    });
  }

  return {
    ...skeleton,
    closed: false,
    inPast: false,
    beyondWindow: false,
    partyTooLarge: false,
    slots,
  };
}

/* -------------------------------------------------------------------------- */
/*  Internals — exported for testing/inspection                               */
/* -------------------------------------------------------------------------- */

export function resolveOccupancyMinutes(
  map: OccupancyDurationMap,
  partySize: number,
): number {
  const exact = map[String(partySize)];
  if (typeof exact === 'number' && exact > 0) return exact;
  const fallback = map['default'];
  if (typeof fallback === 'number' && fallback > 0) return fallback;
  return FALLBACK_OCCUPANCY_MINUTES;
}

export function generateCandidateStarts(
  windows: OpeningWindow[],
  slotIntervalMinutes: number,
  occupancyMs: number,
  earliestStartMs: number,
): number[] {
  const stepMs = slotIntervalMinutes * 60_000;
  const out: number[] = [];
  for (const win of windows) {
    const winStartMs = win.openInstant.getTime();
    const winEndMs = win.closeInstant.getTime();
    const lastValidStartMs = winEndMs - occupancyMs;
    if (lastValidStartMs < winStartMs) continue;
    for (let s = winStartMs; s <= lastValidStartMs; s += stepMs) {
      if (s >= earliestStartMs) out.push(s);
    }
  }
  out.sort((a, b) => a - b);
  // Dedup (overlapping windows are unusual but defensible).
  return out.filter((v, i) => i === 0 || v !== out[i - 1]);
}

export function tableBlockedAt(
  tableId: string,
  newStartMs: number,
  newEndMs: number,
  bufferMs: number,
  existingBookings: ExistingBooking[],
): boolean {
  for (const b of existingBookings) {
    if (b.tableIds.length === 0) continue;
    if (!b.tableIds.includes(tableId)) continue;
    const bStart = b.slotInstant.getTime() - bufferMs;
    const bEnd = b.slotInstant.getTime() + b.durationMinutes * 60_000 + bufferMs;
    if (newStartMs < bEnd && bStart < newEndMs) return true;
  }
  return false;
}

export function guestsOverlapping(
  existingBookings: ExistingBooking[],
  newStartMs: number,
  newEndMs: number,
): number {
  let total = 0;
  for (const b of existingBookings) {
    const bStart = b.slotInstant.getTime();
    const bEnd = b.slotInstant.getTime() + b.durationMinutes * 60_000;
    if (newStartMs < bEnd && bStart < newEndMs) total += b.partySize;
  }
  return total;
}

/* -------------------------------------------------------------------------- */
/*  Local-date helpers (Europe/Amsterdam)                                     */
/* -------------------------------------------------------------------------- */

function localDateInAmsterdam(instant: Date): string {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return dtf.format(instant);
}

function addLocalDays(dateLocal: string, days: number): string {
  const [y, m, d] = dateLocal.split('-').map(Number);
  const utc = new Date(Date.UTC(y, m - 1, d));
  utc.setUTCDate(utc.getUTCDate() + days);
  return utc.toISOString().slice(0, 10);
}

function amsterdamWallClockTime(instant: Date): string {
  const dtf = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const out = dtf.format(instant);
  return out === '24:00' ? '00:00' : out;
}
