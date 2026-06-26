// lib/booking/types.ts
//
// Shared types for the C4 reservation flow.
// Every C4 unit (availability engine, slot picker, guest form, booking creation,
// confirmation, manage, cancel) imports from this file. Do not duplicate these
// shapes elsewhere.

/* -------------------------------------------------------------------------- */
/*  Booking config                                                            */
/* -------------------------------------------------------------------------- */

/**
 * Per-party-size occupancy duration in minutes.
 *
 * Keys are party-size strings ("1", "2", ..., "8") or "default". Values are
 * minutes. Empty object means "use a global default elsewhere".
 *
 * Example: { "2": 90, "4": 120, "default": 90 }
 */
export type OccupancyDurationMap = Record<string, number>;

/**
 * No-show prepay window (jsonb pass-through).
 *
 * Real shape will be locked down in C4.6 when we wire deposit logic. For now,
 * the loader accepts whatever the DB returns and downstream units narrow it.
 * Treat as opaque until C4.6.
 */
export type NoShowPrepayWindow = Record<string, unknown> | null;

/**
 * Booking configuration for a single restaurant, derived from the restaurants
 * row plus a small amount of normalization.
 *
 * All consumer-facing booking logic should read from this object, not from the
 * raw restaurants row, so we have one place to add fallbacks and validation.
 */
export interface BookingConfig {
  /** Restaurant primary key (uuid). */
  restaurantId: string;
  /** Public URL slug. */
  slug: string;
  /** Display name (may be null in DB — caller falls back to legal_name or slug). */
  displayName: string | null;
  /** Legal name from KVK. Always present after onboarding. */
  legalName: string | null;

  /** Earliest bookable = now + minLeadTimeMinutes. */
  minLeadTimeMinutes: number;
  /** Farthest bookable date = today + bookingWindowDays. */
  bookingWindowDays: number;
  /** Largest party size selectable in the online flow. */
  maxPartySizeOnline: number;
  /** Grid granularity in minutes (15, 30, 45, 60). */
  slotIntervalMinutes: number;
  /** Per-slot guest capacity cap, or null if uncapped. */
  maxGuestsPerSlot: number | null;
  /** Occupancy duration per party size, in minutes. May be an empty object. */
  occupancyDurationByParty: OccupancyDurationMap;
  /** Required gap (minutes) between two bookings on the same table. */
  turnoverBufferMinutes: number;

  /** Whether the no-show deposit policy is on. */
  noShowPrepaidEnabled: boolean;
  /** Deposit amount in cents (per guest), or null if not configured. */
  noShowPrepaidAmountCents: number | null;
  /** ISO 4217 currency for the deposit. Always present (default 'EUR'). */
  noShowPrepaidCurrency: string;
  /** Party size at or above which the deposit applies. */
  noShowPrepaidThreshold: number | null;
  /** Opaque window jsonb. Narrowed in C4.6. */
  noShowPrepaidWindow: NoShowPrepayWindow;
  /** T-24h reconfirmation flow enabled. */
  noShowReconfirmationEnabled: boolean;

  /** Show the "allergies" optional question. */
  questionAllergies: boolean;
  /** Show the "occasion" optional question. */
  questionOccasion: boolean;
  /** Show the "special requests" optional question. */
  questionRequests: boolean;

  /** Whether the restaurant accepts waitlist signups when full. */
  waitlistEnabled: boolean;
  /** Whether guests can pick a zone (when multiple zones exist). */
  guestZoneChoiceEnabled: boolean;
  /** Whether the restaurant uses per-service hours overrides. */
  hoursPerServiceOverride: boolean;
}

/* -------------------------------------------------------------------------- */
/*  Loader result                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Discriminated union returned by `loadBookingConfig`. Every consumer of the
 * loader must handle all four cases. We model errors as values (not thrown)
 * because the booking page needs to render different copy per failure mode.
 */
export type BookingConfigResult =
  | { ok: true; config: BookingConfig }
  | { ok: false; error: BookingConfigError };

export type BookingConfigError =
  /** No restaurants row with that slug at all. */
  | 'restaurant_not_found'
  /** Row exists but status != 'live' (still onboarding, suspended, archived). */
  | 'restaurant_not_live'
  /** Live but the reservations service is turned off. */
  | 'reservations_disabled';

/* -------------------------------------------------------------------------- */
/*  Derived helpers (computed; not stored)                                    */
/* -------------------------------------------------------------------------- */

/**
 * Earliest moment (UTC instant) that a guest can book at. Computed at request
 * time from `minLeadTimeMinutes`. Returned as a Date so callers in different
 * timezones don't get confused — render with Europe/Amsterdam at the UI layer.
 */
export function earliestBookableInstant(config: BookingConfig, now: Date = new Date()): Date {
  return new Date(now.getTime() + config.minLeadTimeMinutes * 60_000);
}

/**
 * Latest local-date string (YYYY-MM-DD, Europe/Amsterdam) that the guest can
 * pick. Computed from `bookingWindowDays`. The booking window is measured in
 * civil days in the restaurant's timezone, not in 24-hour ticks.
 */
export function latestBookableDate(config: BookingConfig, now: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Amsterdam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const todayInNL = fmt.format(now); // YYYY-MM-DD
  const [y, m, d] = todayInNL.split('-').map(Number);
  // Build a UTC date for date arithmetic, then advance by window days.
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + config.bookingWindowDays);
  return base.toISOString().slice(0, 10);
}

/**
 * Whether the no-show deposit applies for the given party size.
 *
 * Window-based applicability (`noShowPrepaidWindow`) is **not** evaluated here;
 * that lands in C4.6 when we render the deposit step.
 */
export function depositAppliesForParty(config: BookingConfig, partySize: number): boolean {
  if (!config.noShowPrepaidEnabled) return false;
  if (config.noShowPrepaidAmountCents == null || config.noShowPrepaidAmountCents <= 0) return false;
  if (config.noShowPrepaidThreshold == null) return false;
  return partySize >= config.noShowPrepaidThreshold;
}

/* -------------------------------------------------------------------------- */
/*  Availability — data-layer types                                           */
/* -------------------------------------------------------------------------- */

/**
 * One opening window for a single calendar date (already resolved from the
 * `availability` table for that ISO day_of_week + the `closes_next_day` flag).
 *
 * `openInstant` and `closeInstant` are absolute UTC instants computed in the
 * restaurant's timezone (Europe/Amsterdam). The booking engine treats them as
 * an inclusive-start, exclusive-end interval: a party can start at any slot
 * time T where `openInstant <= T < closeInstant - occupancyDuration`.
 *
 * Multiple windows per date are possible (e.g. lunch 12:00-15:00 + dinner
 * 18:00-22:00 as two rows in `availability`).
 */
export interface OpeningWindow {
  /** Source row id (for debug / dev inspector). */
  id: string;
  /** Absolute UTC start of the window. */
  openInstant: Date;
  /** Absolute UTC end of the window. */
  closeInstant: Date;
  /** Did the source row have closes_next_day = true? */
  closesNextDay: boolean;
  /** Source service_scope. Engine filters to 'all' | 'reservations' upstream. */
  serviceScope: string;
  /** Service tags from the source row (UI grouping concern; engine passes through). */
  tags: { brunch: boolean; lunch: boolean; dinner: boolean };
}

/**
 * A zone with its bookable tables. Deleted zones and deleted/non-bookable
 * tables are excluded by the query layer.
 */
export interface BookableZone {
  id: string;
  name: string;
  displayOrder: number;
  tables: BookableTable[];
}

export interface BookableTable {
  id: string;
  zoneId: string;
  label: string;
  seats: number;
}

/**
 * An existing booking that the engine must check for conflict.
 *
 * `tableIds` may be empty when the booking has only a zone-level assignment
 * (legacy / staff-pending). The engine treats an empty-tableIds active booking
 * as occupying one table-equivalent in its zone for capacity purposes (see
 * computeAvailability for the precise rule).
 *
 * Only bookings on the requested calendar date (Europe/Amsterdam) are loaded;
 * the query layer applies a time range filter that covers the date plus the
 * largest possible turnover-buffer-extended overlap on either side.
 */
export interface ExistingBooking {
  id: string;
  partySize: number;
  zoneId: string | null;
  slotInstant: Date;
  durationMinutes: number;
  status: 'pending' | 'confirmed' | 'attended';
  /** Tables this booking occupies. Empty when no booking_tables rows exist yet. */
  tableIds: string[];
}

/**
 * All inputs the pure compute function needs for one (restaurant, date, partySize)
 * combination. Produced by `loadAvailabilityInputs`.
 */
export interface AvailabilityInputs {
  /** ISO date in Europe/Amsterdam, e.g. "2026-07-04". */
  dateLocal: string;
  /** ISO day of week 1-7 (Mon=1) for `dateLocal`. */
  isoDayOfWeek: number;
  /** Opening windows for that date (may be empty = closed). */
  windows: OpeningWindow[];
  /** All bookable zones with their tables (deleted excluded). */
  zones: BookableZone[];
  /** Active bookings overlapping the date (and turnover-buffer halo). */
  existingBookings: ExistingBooking[];
}

/* -------------------------------------------------------------------------- */
/*  Availability — compute output                                             */
/* -------------------------------------------------------------------------- */

/**
 * Final result of `computeAvailability`. All boolean flags are mutually
 * non-exclusive in principle (e.g. a closed Sunday could also be in the past)
 * but the compute function returns the earliest-detected flag first. Slots is
 * `[]` whenever any flag is true.
 */
export interface AvailabilityResult {
  date: string;
  partySize: number;
  occupancyMinutes: number;
  slotIntervalMinutes: number;

  closed: boolean;
  inPast: boolean;
  beyondWindow: boolean;
  partyTooLarge: boolean;

  slots: AvailabilitySlot[];
}

export interface AvailabilitySlot {
  /** Local wall-clock time in Europe/Amsterdam, "HH:MM". */
  time: string;
  /** Absolute UTC instant, ISO string. */
  instant: string;
  /** Zones with at least one free fitting table at this slot. */
  availableZoneIds: string[];
  /** Count of free fitting tables across all zones. */
  remainingTables: number;
  /** Count of fitting tables ignoring conflicts (capacity ceiling). */
  totalCandidateTables: number;
}
