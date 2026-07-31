// app/api/dashboard/bookings/walk-in/route.ts
//
// POST /api/dashboard/bookings/walk-in
//
// Creates a walk-in booking: a guest already at the table, added by staff
// from the dashboard. Immediately `status='attended'`, `slot_time=now`,
// `source='walk_in'`. No deposit, no confirmation email, no reminder, no
// magic link sent — excluded from the daily booking limit (PRD §13).
//
// If the supplied phone matches a guest who has booked at THIS restaurant
// before, the walk-in links to that guest (silent match, no confirmation
// modal) — never cross-restaurant (D2.2 privacy rule). Otherwise a fresh
// guest row is created with email left null (walk-ins are never asked for
// one).
//
// `bookings.magic_link_token_hash` is NOT NULL with no DEFAULT and no
// "walk-in" carve-out in the schema. Walk-ins have no manage-booking use
// case, so a token is generated and hashed purely to satisfy the column —
// the plaintext is discarded immediately and no `magic_links` row is created.

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient, createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { assertDashboardWriteAllowed } from '@/lib/dashboard/guards/assertDashboardWriteAllowed';
import { dashboardMutationRateLimit } from '@/lib/dashboard/rateLimit';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { invalidateConsumerPage } from '@/lib/consumer/cache';
import { acquireSlotLock, releaseSlotLock } from '@/lib/booking/slotLock';
import { loadBookingConfig } from '@/lib/booking/config';
import { loadAvailabilityInputs } from '@/lib/booking/queries';
import { resolveOccupancyMinutes, tableBlockedAt } from '@/lib/booking/computeAvailability';
import { generateBookingRef } from '@/lib/booking/bookingRef';
import { generateMagicLinkToken, hashMagicLinkToken } from '@/lib/consumer/magicLinks';
import { normalizePhone } from '@/lib/consumer/sanitize';
import { findExistingGuestByPhoneAtRestaurant } from '@/lib/dashboard/queries/guests';
import { amsterdamCivilDate } from '@/lib/dashboard/date/amsterdamDay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_NAME_LENGTH = 80;
const MIN_PARTY_SIZE = 1;
const MAX_PARTY_SIZE = 30;
const MAX_TABLE_IDS = 12;
const MAX_NOTE_LENGTH = 500;
const MIN_DURATION_MINUTES = 15;
const MAX_DURATION_MINUTES = 360;

type ParsedBody = {
  fullName: string;
  phone: string | null;
  partySize: number;
  zoneId: string;
  tableIds: string[];
  guestNote: string | null;
  durationMinutes: number | null;
};

type ParseResult = { ok: true; body: ParsedBody } | { ok: false; code: string };

function parseBody(raw: unknown): ParseResult {
  if (typeof raw !== 'object' || raw === null) return { ok: false, code: 'invalid_body' };
  const b = raw as Record<string, unknown>;

  if (typeof b.full_name !== 'string') return { ok: false, code: 'invalid_body' };
  const fullName = b.full_name.trim();
  if (fullName.length === 0 || fullName.length > MAX_NAME_LENGTH) return { ok: false, code: 'invalid_body' };

  if (typeof b.party_size !== 'number' || !Number.isInteger(b.party_size) || b.party_size < MIN_PARTY_SIZE || b.party_size > MAX_PARTY_SIZE) {
    return { ok: false, code: 'party_size_out_of_range' };
  }

  if (typeof b.zone_id !== 'string' || b.zone_id.length === 0) return { ok: false, code: 'invalid_body' };

  if (
    !Array.isArray(b.table_ids) ||
    b.table_ids.length < 1 ||
    b.table_ids.length > MAX_TABLE_IDS ||
    !b.table_ids.every((t) => typeof t === 'string' && t.length > 0)
  ) {
    return { ok: false, code: 'invalid_body' };
  }

  let phone: string | null = null;
  if (b.phone !== undefined && b.phone !== null && b.phone !== '') {
    if (typeof b.phone !== 'string') return { ok: false, code: 'invalid_phone' };
    const normalized = normalizePhone(b.phone);
    if (!normalized) return { ok: false, code: 'invalid_phone' };
    phone = normalized;
  }

  let guestNote: string | null = null;
  if (b.guest_note !== undefined && b.guest_note !== null) {
    if (typeof b.guest_note !== 'string') return { ok: false, code: 'invalid_body' };
    const trimmed = b.guest_note.trim();
    if (trimmed.length > MAX_NOTE_LENGTH) return { ok: false, code: 'invalid_body' };
    guestNote = trimmed.length > 0 ? trimmed : null;
  }

  let durationMinutes: number | null = null;
  if (b.duration_minutes !== undefined && b.duration_minutes !== null) {
    if (
      typeof b.duration_minutes !== 'number' ||
      !Number.isInteger(b.duration_minutes) ||
      b.duration_minutes < MIN_DURATION_MINUTES ||
      b.duration_minutes > MAX_DURATION_MINUTES
    ) {
      return { ok: false, code: 'invalid_body' };
    }
    durationMinutes = b.duration_minutes;
  }

  return {
    ok: true,
    body: {
      fullName,
      phone,
      partySize: b.party_size,
      zoneId: b.zone_id,
      tableIds: b.table_ids as string[],
      guestNote,
      durationMinutes,
    },
  };
}

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const rl = await dashboardMutationRateLimit(user.id);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60), 'Cache-Control': 'no-store' } },
    );
  }

  const { data: restaurant, error: restaurantError } = await supabase
    .from('restaurants')
    .select('id, slug')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (restaurantError || !restaurant) {
    return NextResponse.json({ error: 'restaurant_not_found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  const guard = await assertDashboardWriteAllowed(restaurant.id, 'booking.walk_in.create');
  if (!guard.ok) {
    return NextResponse.json({ error: guard.reason }, { status: guard.httpStatus, headers: { 'Cache-Control': 'no-store' } });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const parsed = parseBody(rawBody);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.code }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  const { body } = parsed;

  const configResult = await loadBookingConfig(restaurant.slug);
  if (!configResult.ok) {
    return NextResponse.json({ error: 'restaurant_not_found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  const config = configResult.config;

  const slotInstant = new Date();
  const slotInstantIso = slotInstant.toISOString();
  const durationMinutes = body.durationMinutes ?? resolveOccupancyMinutes(config.occupancyDurationByParty, body.partySize);

  const dateLocal = amsterdamCivilDate(slotInstant);
  const inputs = await loadAvailabilityInputs(config, dateLocal);

  const zone = inputs.zones.find((z) => z.id === body.zoneId);
  if (!zone) {
    return NextResponse.json({ error: 'zone_or_table_mismatch' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  const tableSeatsById = new Map<string, number>();
  for (const table of zone.tables) tableSeatsById.set(table.id, table.seats);
  if (!body.tableIds.every((id) => tableSeatsById.has(id))) {
    return NextResponse.json({ error: 'zone_or_table_mismatch' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const totalSeats = body.tableIds.reduce((sum, id) => sum + (tableSeatsById.get(id) ?? 0), 0);
  if (body.partySize > totalSeats) {
    return NextResponse.json({ error: 'over_capacity' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  if (body.partySize * 2 < totalSeats) {
    return NextResponse.json({ error: 'half_full_violated' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const bufferMs = config.turnoverBufferMinutes * 60_000;
  const newStartMs = slotInstant.getTime();
  const newEndMs = newStartMs + durationMinutes * 60_000;
  const conflictOutsideLock = body.tableIds.some((tableId) =>
    tableBlockedAt(tableId, newStartMs, newEndMs, bufferMs, inputs.existingBookings),
  );
  if (conflictOutsideLock) {
    return NextResponse.json({ error: 'table_conflict' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const lock = await acquireSlotLock(restaurant.id, slotInstantIso);
  if (!lock.ok) {
    return NextResponse.json({ error: 'slot_lock_timeout' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const freshInputs = await loadAvailabilityInputs(config, dateLocal);
    const conflictInLock = body.tableIds.some((tableId) =>
      tableBlockedAt(tableId, newStartMs, newEndMs, bufferMs, freshInputs.existingBookings),
    );
    if (conflictInLock) {
      return NextResponse.json({ error: 'table_conflict' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    const admin = await createSupabaseServerClientAdmin();

    let guestId: string;
    let matchedExistingGuest = false;
    let visitCountBefore = 0;

    if (body.phone) {
      const match = await findExistingGuestByPhoneAtRestaurant(restaurant.id, body.phone);
      if (match) {
        guestId = match.guest.id;
        matchedExistingGuest = true;
        visitCountBefore = match.visitCount;
        if (match.guest.full_name.trim().toLowerCase() !== body.fullName.toLowerCase()) {
          await admin.from('guests').update({ full_name: body.fullName }).eq('id', guestId);
        }
      } else {
        const { data: created, error: guestInsErr } = await admin
          .from('guests')
          .insert({ full_name: body.fullName, email: null, phone: body.phone })
          .select('id')
          .single();
        if (guestInsErr || !created) {
          console.error('[bookings/walk-in] guest insert failed', { code: guestInsErr?.code });
          return NextResponse.json({ error: 'db_error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
        }
        guestId = created.id;
      }
    } else {
      const { data: created, error: guestInsErr } = await admin
        .from('guests')
        .insert({ full_name: body.fullName, email: null, phone: null })
        .select('id')
        .single();
      if (guestInsErr || !created) {
        console.error('[bookings/walk-in] guest insert failed', { code: guestInsErr?.code });
        return NextResponse.json({ error: 'db_error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
      }
      guestId = created.id;
    }

    const magicLinkHash = hashMagicLinkToken(generateMagicLinkToken());
    let bookingRef = generateBookingRef();
    const bookingPayload = {
      restaurant_id: restaurant.id,
      guest_id: guestId,
      booking_ref: bookingRef,
      party_size: body.partySize,
      zone_id: body.zoneId,
      slot_time: slotInstantIso,
      duration_minutes: durationMinutes,
      status: 'attended' as const,
      source: 'walk_in' as const,
      attended_at: slotInstantIso,
      attended_marked_by: guard.staff.id,
      guest_note: body.guestNote,
      magic_link_token_hash: magicLinkHash,
    };

    let { data: booking, error: bookingErr } = await admin
      .from('bookings')
      .insert(bookingPayload)
      .select('id')
      .single();
    if (bookingErr && bookingErr.code === '23505') {
      bookingRef = generateBookingRef();
      const retry = await admin
        .from('bookings')
        .insert({ ...bookingPayload, booking_ref: bookingRef })
        .select('id')
        .single();
      booking = retry.data;
      bookingErr = retry.error;
    }
    if (bookingErr || !booking) {
      console.error('[bookings/walk-in] booking insert failed', { code: bookingErr?.code });
      return NextResponse.json({ error: 'db_error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }

    const { error: btError } = await admin
      .from('booking_tables')
      .insert(body.tableIds.map((tableId) => ({ booking_id: booking.id, table_id: tableId })));
    if (btError) {
      console.error('[bookings/walk-in] booking_tables insert failed; rolling back', { code: btError.code });
      await admin.from('bookings').delete().eq('id', booking.id);
      return NextResponse.json({ error: 'db_error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }

    await dashboardAudit({
      restaurantId: restaurant.id,
      staffId: guard.staff.id,
      eventType: 'booking.walk_in.created',
      eventData: {
        party_size: body.partySize,
        zone_id: body.zoneId,
        table_ids: body.tableIds,
        matched_existing_guest: matchedExistingGuest,
        visit_count_before: visitCountBefore,
        guest_id: guestId,
        duration_minutes: durationMinutes,
      },
      bookingId: booking.id,
    });

    invalidateConsumerPage(restaurant.slug);

    return NextResponse.json(
      {
        ok: true,
        booking_id: booking.id,
        guest_id: guestId,
        matched_existing_guest: matchedExistingGuest,
        visit_count_before: visitCountBefore,
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } finally {
    await releaseSlotLock(lock.token, restaurant.id, slotInstantIso);
  }
}
