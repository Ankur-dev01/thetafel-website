// lib/booking/config.ts
//
// loadBookingConfig(slug) — returns a discriminated union so the booking page
// can render the correct error UI per failure mode. Read-only. Admin client.

import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import type { BookingConfig, BookingConfigResult, OccupancyDurationMap } from './types';

/**
 * Columns we select from `restaurants`. Keep this list explicit so a schema
 * change forces a TypeScript update.
 */
const BOOKING_CONFIG_COLUMNS = [
  'id',
  'slug',
  'display_name',
  'legal_name',
  'status',
  'service_reservations_enabled',
  'min_lead_time_minutes',
  'booking_window_days',
  'max_party_size_online',
  'slot_interval_minutes',
  'max_guests_per_slot',
  'occupancy_duration_by_party',
  'occupancy_duration_minutes',
  'turnover_buffer_minutes',
  'noshow_prepaid_enabled',
  'noshow_prepaid_amount_cents',
  'noshow_prepaid_currency',
  'noshow_prepaid_threshold',
  'noshow_prepaid_window',
  'noshow_reconfirmation_enabled',
  'booking_question_allergies',
  'booking_question_occasion',
  'booking_question_requests',
  'waitlist_enabled',
  'guest_zone_choice_enabled',
  'hours_per_service_override',
].join(', ');

interface RawRestaurantRow {
  id: string;
  slug: string;
  display_name: string | null;
  legal_name: string | null;
  status: string;
  service_reservations_enabled: boolean;
  min_lead_time_minutes: number | null;
  booking_window_days: number | null;
  max_party_size_online: number;
  slot_interval_minutes: number | null;
  max_guests_per_slot: number | null;
  occupancy_duration_by_party: unknown;
  occupancy_duration_minutes: number | null;
  turnover_buffer_minutes: number;
  noshow_prepaid_enabled: boolean;
  noshow_prepaid_amount_cents: number | null;
  noshow_prepaid_currency: string;
  noshow_prepaid_threshold: number | null;
  noshow_prepaid_window: unknown;
  noshow_reconfirmation_enabled: boolean;
  booking_question_allergies: boolean;
  booking_question_occasion: boolean;
  booking_question_requests: boolean;
  waitlist_enabled: boolean;
  guest_zone_choice_enabled: boolean;
  hours_per_service_override: boolean;
}

/**
 * Normalize the occupancy_duration_by_party jsonb into a typed map.
 * Returns {} for null, non-object, or empty input.
 */
function normalizeOccupancyMap(raw: unknown): OccupancyDurationMap {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: OccupancyDurationMap = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
      out[k] = Math.round(v);
    }
  }
  return out;
}

/**
 * Merge the restaurant's base `occupancy_duration_minutes` into the per-party
 * override map as the `default` key.
 *
 * The base column is authoritative for "how long a meal takes when no per-party
 * override is set." A user-set `default` in the map (rare — currently no UI
 * writes it) still wins over the base column, for future-proofing.
 *
 * If the base column is null (very old rows or misconfigured restaurants),
 * we leave the map untouched — resolveOccupancyMinutes will fall back to
 * FALLBACK_OCCUPANCY_MINUTES, which is the last-resort safety net.
 */
function mergeOccupancyMap(
  perPartyMap: OccupancyDurationMap,
  baseMinutes: number | null,
): OccupancyDurationMap {
  if (typeof baseMinutes !== 'number' || !Number.isFinite(baseMinutes) || baseMinutes <= 0) {
    return perPartyMap;
  }
  if (typeof perPartyMap.default === 'number' && perPartyMap.default > 0) {
    return perPartyMap;
  }
  return { ...perPartyMap, default: Math.round(baseMinutes) };
}

/**
 * Load the booking configuration for a restaurant by slug.
 *
 * Returns a discriminated union — every caller must handle:
 *   - { ok: true, config }
 *   - { ok: false, error: 'restaurant_not_found' }
 *   - { ok: false, error: 'restaurant_not_live' }
 *   - { ok: false, error: 'reservations_disabled' }
 *
 * Uses the admin Supabase client to bypass RLS, because public RLS hides
 * non-live restaurants and we need to distinguish "doesn't exist" from
 * "exists but not live". Only public/operational fields are read.
 */
export async function loadBookingConfig(slug: string): Promise<BookingConfigResult> {
  const trimmed = slug?.trim();
  if (!trimmed) return { ok: false, error: 'restaurant_not_found' };

  const supabase = await createSupabaseServerClientAdmin();

  const { data, error } = await supabase
    .from('restaurants')
    .select(BOOKING_CONFIG_COLUMNS)
    .eq('slug', trimmed)
    .maybeSingle<RawRestaurantRow>();

  if (error) {
    // Surface as not-found to avoid leaking internals; the caller logs.
    console.error('[booking/config] supabase error', { slug: trimmed, code: error.code });
    return { ok: false, error: 'restaurant_not_found' };
  }
  if (!data) return { ok: false, error: 'restaurant_not_found' };
  if (data.status !== 'live') return { ok: false, error: 'restaurant_not_live' };
  if (!data.service_reservations_enabled) return { ok: false, error: 'reservations_disabled' };

  const config: BookingConfig = {
    restaurantId: data.id,
    slug: data.slug,
    displayName: data.display_name,
    legalName: data.legal_name,

    minLeadTimeMinutes: data.min_lead_time_minutes ?? 60,
    bookingWindowDays: data.booking_window_days ?? 90,
    maxPartySizeOnline: data.max_party_size_online,
    slotIntervalMinutes: data.slot_interval_minutes ?? 30,
    maxGuestsPerSlot: data.max_guests_per_slot,
    occupancyDurationByParty: mergeOccupancyMap(
      normalizeOccupancyMap(data.occupancy_duration_by_party),
      data.occupancy_duration_minutes,
    ),
    turnoverBufferMinutes: data.turnover_buffer_minutes ?? 15,

    noShowPrepaidEnabled: data.noshow_prepaid_enabled,
    noShowPrepaidAmountCents: data.noshow_prepaid_amount_cents,
    noShowPrepaidCurrency: data.noshow_prepaid_currency || 'EUR',
    noShowPrepaidThreshold: data.noshow_prepaid_threshold,
    noShowPrepaidWindow:
      data.noshow_prepaid_window && typeof data.noshow_prepaid_window === 'object'
        ? (data.noshow_prepaid_window as Record<string, unknown>)
        : null,
    noShowReconfirmationEnabled: data.noshow_reconfirmation_enabled,

    questionAllergies: data.booking_question_allergies,
    questionOccasion: data.booking_question_occasion,
    questionRequests: data.booking_question_requests,

    waitlistEnabled: data.waitlist_enabled,
    guestZoneChoiceEnabled: data.guest_zone_choice_enabled,
    hoursPerServiceOverride: data.hours_per_service_override,
  };

  return { ok: true, config };
}
