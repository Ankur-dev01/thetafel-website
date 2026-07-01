// lib/booking/createBooking.ts
//
// Transactional booking creation. Re-checks availability, picks a specific
// table, upserts guest, generates magic link token, inserts booking +
// booking_tables + magic_links row, returns bookingRef + plaintext token.
//
// Server-only. Caller (the route handler) handles rate-limit, Turnstile,
// audit, and dispatcher.

import 'server-only';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { loadAvailabilityInputs } from './queries';
import { computeAvailability, tableBlockedAt } from './computeAvailability';
import { composeGuestNote } from './composeNote';
import { generateBookingRef } from './bookingRef';
import { generateMagicLinkToken, hashMagicLinkToken } from '@/lib/consumer/magicLinks';
import { normalizePhone } from '@/lib/consumer/sanitize';
import { acquireSlotLock, releaseSlotLock } from './slotLock';
import type { BookingConfig } from './types';
import type { CreateBookingInput } from './createBookingSchema';

const IDEMPOTENCY_LOOKBACK_MINUTES = 10;
const MANAGE_LINK_TTL_DAYS = 90;

export type CreateBookingResult =
  | {
      ok: true;
      bookingId: string;
      bookingRef: string;
      restaurantId: string;
      occupancyMinutes: number;
      magicLinkPlaintext: string;
      idempotentReplay: boolean;
    }
  | {
      ok: false;
      error: CreateBookingError;
      errorDetail?: {
        stage: string;
        code?: string;
        message?: string;
        hint?: string;
        details?: string;
      };
    };

export type CreateBookingError =
  | 'slot_no_longer_available'
  | 'slot_temporarily_busy'
  | 'persistence_failed';

export async function createBooking(
  input: CreateBookingInput,
  config: BookingConfig,
): Promise<CreateBookingResult> {
  const supabase = await createSupabaseServerClientAdmin();

  // ── 0. Idempotency check ──────────────────────────────────────────────────
  const { data: existing } = await supabase
    .from('bookings')
    .select('id, booking_ref, duration_minutes')
    .eq('idempotency_key', input.idempotencyKey)
    .gte(
      'created_at',
      new Date(Date.now() - IDEMPOTENCY_LOOKBACK_MINUTES * 60_000).toISOString(),
    )
    .maybeSingle();

  if (existing) {
    return {
      ok: true,
      bookingId: existing.id,
      bookingRef: existing.booking_ref,
      restaurantId: config.restaurantId,
      occupancyMinutes: existing.duration_minutes ?? 90,
      magicLinkPlaintext: '',
      idempotentReplay: true,
    };
  }

  // ── 1. Slot lock (serializes concurrent submits for the same slot) ────────
  const lock = await acquireSlotLock(config.restaurantId, input.slotInstant);
  if (!lock.ok) {
    return {
      ok: false,
      error: 'slot_temporarily_busy',
      errorDetail: {
        stage: 'slot_lock',
        code: lock.reason,
        message:
          lock.reason === 'busy'
            ? 'Another booking attempt for this slot is in progress. Please retry.'
            : 'Booking service temporarily unavailable. Please retry.',
      },
    };
  }

  try {
    // ── 2. Re-check availability (fresh, inside the lock) ───────────────────
    const inputs = await loadAvailabilityInputs(config, input.date);
    const avail = computeAvailability(config, inputs, input.partySize);
    const stillAvailable = avail.slots.some((s) => s.instant === input.slotInstant);
    if (!stillAvailable) {
      return { ok: false, error: 'slot_no_longer_available' };
    }

    // ── 3. Pick a specific table (smallest-fits-first + half-full rule) ─────
    const slotStartMs = new Date(input.slotInstant).getTime();
    const occupancyMs = avail.occupancyMinutes * 60_000;
    const slotEndMs = slotStartMs + occupancyMs;
    const bufferMs = config.turnoverBufferMinutes * 60_000;

    const candidateZoneIds = input.zoneId ? [input.zoneId] : input.selectedSlotZoneIds;

    let pickedTableId: string | null = null;
    let pickedZoneId: string | null = null;

    for (const zoneId of candidateZoneIds) {
      const zone = inputs.zones.find((z) => z.id === zoneId);
      if (!zone) continue;
      const fitting = zone.tables
        .filter(
          (t) => t.seats >= input.partySize && t.seats <= input.partySize * 2,
        )
        .sort((a, b) => a.seats - b.seats);
      for (const table of fitting) {
        if (!tableBlockedAt(table.id, slotStartMs, slotEndMs, bufferMs, inputs.existingBookings)) {
          pickedTableId = table.id;
          pickedZoneId = zone.id;
          break;
        }
      }
      if (pickedTableId) break;
    }

    if (!pickedTableId || !pickedZoneId) {
      return { ok: false, error: 'slot_no_longer_available' };
    }

    // ── 4. Upsert guest ───────────────────────────────────────────────────────
    const emailNormalized = input.guest.email.trim().toLowerCase();
    const phoneNormalized = normalizePhone(input.guest.phone);
    if (!phoneNormalized) {
      return {
        ok: false,
        error: 'persistence_failed',
        errorDetail: {
          stage: 'phone_normalize',
          code: 'INVALID_PHONE_FORMAT',
          message: `Phone number "${input.guest.phone}" could not be normalized to E.164`,
        },
      };
    }

    const { data: existingGuest, error: guestLookupErr } = await supabase
      .from('guests')
      .select('id')
      .eq('email_lower', emailNormalized)
      .maybeSingle();

    if (guestLookupErr) {
      console.error('[booking/create] guest lookup failed', {
        code: guestLookupErr.code,
        message: guestLookupErr.message,
      });
      return {
        ok: false,
        error: 'persistence_failed',
        errorDetail: {
          stage: 'guest_lookup',
          code: guestLookupErr.code,
          message: guestLookupErr.message,
          hint: (guestLookupErr as unknown as { hint?: string }).hint,
          details: (guestLookupErr as unknown as { details?: string }).details,
        },
      };
    }

    let guestId: string;
    if (existingGuest) {
      guestId = existingGuest.id;
      const patch: Record<string, unknown> = {
        full_name: input.guest.name.trim(),
        phone: phoneNormalized,
      };
      if (input.marketingConsent) {
        patch.marketing_consent = true;
        patch.marketing_consent_at = new Date().toISOString();
      }
      const { error: guestUpdErr } = await supabase
        .from('guests')
        .update(patch)
        .eq('id', guestId);
      if (guestUpdErr) {
        // Soft-fail: booking continues with the existing guest row as-is.
        console.error('[booking/create] guest update failed', {
          code: guestUpdErr.code,
          message: guestUpdErr.message,
        });
      }
    } else {
      const { data: created, error: guestInsErr } = await supabase
        .from('guests')
        .insert({
          full_name: input.guest.name.trim(),
          email: input.guest.email.trim(),
          phone: phoneNormalized,
          marketing_consent: input.marketingConsent,
          marketing_consent_at: input.marketingConsent ? new Date().toISOString() : null,
        })
        .select('id')
        .single();
      if (guestInsErr || !created) {
        console.error('[booking/create] guest insert failed', {
          code: guestInsErr?.code,
          message: guestInsErr?.message,
          details: guestInsErr?.details,
          hint: guestInsErr?.hint,
        });
        return {
          ok: false,
          error: 'persistence_failed',
          errorDetail: {
            stage: 'guest_insert',
            code: guestInsErr?.code,
            message: guestInsErr?.message,
            hint: (guestInsErr as unknown as { hint?: string } | null)?.hint,
            details: (guestInsErr as unknown as { details?: string } | null)?.details,
          },
        };
      }
      guestId = created.id;
    }

    // ── 5. Compose guest note ─────────────────────────────────────────────────
    const guestNote = composeGuestNote(
      {
        name: input.guest.name,
        email: input.guest.email,
        phone: input.guest.phone,
        note: input.guest.note ?? '',
        allergies: input.allergies,
        occasion: input.occasion,
        requests: input.requests,
      },
      {
        showAllergies: config.questionAllergies,
        showOccasion: config.questionOccasion,
        showRequests: config.questionRequests,
        locale: input.locale,
      },
    );

    // ── 6. Generate magic-link token (pure — no DB yet) ───────────────────────
    const magicLinkPlaintext = generateMagicLinkToken();
    const magicLinkHash = hashMagicLinkToken(magicLinkPlaintext);

    // ── 7. Insert booking (magic_link_token_hash satisfies NOT NULL) ──────────
    let bookingRef = generateBookingRef();
    const bookingId = crypto.randomUUID();

    const bookingPayload = {
      id: bookingId,
      restaurant_id: config.restaurantId,
      guest_id: guestId,
      booking_ref: bookingRef,
      party_size: input.partySize,
      zone_id: pickedZoneId,
      slot_time: input.slotInstant,
      duration_minutes: avail.occupancyMinutes,
      status: 'confirmed' as const,
      guest_note: guestNote || null,
      idempotency_key: input.idempotencyKey,
      magic_link_token_hash: magicLinkHash,
    };

    let { error: bookingErr } = await supabase.from('bookings').insert(bookingPayload);
    if (bookingErr && bookingErr.code === '23505') {
      // Unique violation — most likely booking_ref collision. Retry once.
      bookingRef = generateBookingRef();
      const retry = await supabase
        .from('bookings')
        .insert({ ...bookingPayload, booking_ref: bookingRef });
      bookingErr = retry.error;
    }
    if (bookingErr) {
      console.error('[booking/create] booking insert failed', {
        code: bookingErr.code,
        message: bookingErr.message,
        details: bookingErr.details,
        hint: bookingErr.hint,
      });
      return {
        ok: false,
        error: 'persistence_failed',
        errorDetail: {
          stage: 'booking_insert',
          code: bookingErr.code,
          message: bookingErr.message,
          hint: bookingErr.hint,
          details: bookingErr.details,
        },
      };
    }

    // ── 8. Insert booking_tables ──────────────────────────────────────────────
    const { error: btErr } = await supabase
      .from('booking_tables')
      .insert({ booking_id: bookingId, table_id: pickedTableId });
    if (btErr) {
      console.error('[booking/create] booking_tables insert failed; rolling back', {
        code: btErr.code,
        message: btErr.message,
      });
      await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', bookingId);
      return {
        ok: false,
        error: 'persistence_failed',
        errorDetail: {
          stage: 'booking_tables_insert',
          code: btErr.code,
          message: btErr.message,
          hint: (btErr as unknown as { hint?: string }).hint,
          details: (btErr as unknown as { details?: string }).details,
        },
      };
    }

    // ── 9. Insert magic_links row (FK satisfied — booking exists) ─────────────
    const expiresAt = new Date(
      Date.now() + MANAGE_LINK_TTL_DAYS * 24 * 3600 * 1000,
    ).toISOString();

    const { error: mlErr } = await supabase.from('magic_links').insert({
      token_hash: magicLinkHash,
      purpose: 'manage_booking',
      booking_id: bookingId,
      expires_at: expiresAt,
    });
    if (mlErr) {
      // Non-fatal: booking is confirmed; magic_links row is supplementary.
      // The confirmed page can look up by bookings.magic_link_token_hash.
      console.error('[booking/create] magic_links insert failed (booking kept)', {
        code: mlErr.code,
        message: mlErr.message,
      });
    }

    return {
      ok: true,
      bookingId,
      bookingRef,
      restaurantId: config.restaurantId,
      occupancyMinutes: avail.occupancyMinutes,
      magicLinkPlaintext,
      idempotentReplay: false,
    };
  } finally {
    // Always release the lock, whether we succeeded, returned early, or threw.
    await releaseSlotLock(lock.token, config.restaurantId, input.slotInstant);
  }
}
