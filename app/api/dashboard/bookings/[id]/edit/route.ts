// app/api/dashboard/bookings/[id]/edit/route.ts
//
// POST /api/dashboard/bookings/{id}/edit
// Body: { slot_time?, party_size?, zone_id?, table_ids?, guest_note? } — a
// diff; only present fields are validated/written.
//
// Re-runs, server-side, against the NEW values: field ranges, zone/table
// ownership, availability-window fit (weekly `availability` row OR an
// `availability_exceptions` override for that date — the consumer-facing
// availability engine does not check exceptions at all, a pre-existing gap;
// this route checks them directly via getServiceWindowsForDay, same as the
// D2.1 Vandaag/Reserveringen exception-aware logic), the half-full rule, and
// a table/time overlap check. First validation failure wins (400). Slot-
// locked whenever a capacity-relevant field (slot_time/party_size/zone_id/
// table_ids) is part of the patch.

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient, createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { assertDashboardWriteAllowed } from '@/lib/dashboard/guards/assertDashboardWriteAllowed';
import { dashboardMutationRateLimit } from '@/lib/dashboard/rateLimit';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { invalidateConsumerPage } from '@/lib/consumer/cache';
import { acquireSlotLock, releaseSlotLock } from '@/lib/booking/slotLock';
import { loadBookingConfig } from '@/lib/booking/config';
import { loadAvailabilityInputs } from '@/lib/booking/queries';
import { tableBlockedAt } from '@/lib/booking/computeAvailability';
import { getServiceWindowsForDay } from '@/lib/dashboard/queries/bookings';
import { amsterdamCivilDate } from '@/lib/dashboard/date/amsterdamDay';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_PARTY_SIZE = 30;
const MAX_TABLE_IDS = 12;
const MAX_NOTE_LENGTH = 500;

type ParsedPatch = {
  slot_time?: string;
  party_size?: number;
  zone_id?: string;
  table_ids?: string[];
  guest_note?: string | null;
};

function parsePatch(body: unknown): { ok: true; patch: ParsedPatch } | { ok: false } {
  if (typeof body !== 'object' || body === null) return { ok: false };
  const b = body as Record<string, unknown>;
  const patch: ParsedPatch = {};

  if ('slot_time' in b) {
    if (typeof b.slot_time !== 'string' || Number.isNaN(new Date(b.slot_time).getTime())) return { ok: false };
    patch.slot_time = b.slot_time;
  }
  if ('party_size' in b) {
    if (typeof b.party_size !== 'number' || !Number.isInteger(b.party_size) || b.party_size < 1 || b.party_size > MAX_PARTY_SIZE) {
      return { ok: false };
    }
    patch.party_size = b.party_size;
  }
  if ('zone_id' in b) {
    if (typeof b.zone_id !== 'string' || b.zone_id.length === 0) return { ok: false };
    patch.zone_id = b.zone_id;
  }
  if ('table_ids' in b) {
    if (
      !Array.isArray(b.table_ids) ||
      b.table_ids.length < 1 ||
      b.table_ids.length > MAX_TABLE_IDS ||
      !b.table_ids.every((t) => typeof t === 'string' && t.length > 0)
    ) {
      return { ok: false };
    }
    patch.table_ids = b.table_ids as string[];
  }
  if ('guest_note' in b) {
    if (b.guest_note !== null && typeof b.guest_note !== 'string') return { ok: false };
    const trimmed = typeof b.guest_note === 'string' ? b.guest_note.trim() : null;
    if (trimmed !== null && trimmed.length > MAX_NOTE_LENGTH) return { ok: false };
    patch.guest_note = trimmed === '' ? null : trimmed;
  }

  return { ok: true, patch };
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: bookingId } = await ctx.params;

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

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  if (typeof rawBody !== 'object' || rawBody === null || Object.keys(rawBody as object).length === 0) {
    return NextResponse.json({ error: 'no_changes' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const parsed = parsePatch(rawBody);
  if (!parsed.ok) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  const { patch } = parsed;
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'no_changes' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
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

  const guard = await assertDashboardWriteAllowed(restaurant.id, 'booking.edit');
  if (!guard.ok) {
    return NextResponse.json({ error: guard.reason }, { status: guard.httpStatus, headers: { 'Cache-Control': 'no-store' } });
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, slot_time, party_size, zone_id, duration_minutes, guest_note')
    .eq('id', bookingId)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle();
  if (!booking) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  if (booking.status !== 'pending' && booking.status !== 'confirmed') {
    return NextResponse.json({ error: 'terminal_state' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
  }

  const admin = await createSupabaseServerClientAdmin();
  const { data: currentTableRows } = await admin
    .from('booking_tables')
    .select('table_id')
    .eq('booking_id', bookingId);
  const currentTableIds = (currentTableRows ?? []).map((r) => r.table_id as string);

  const capacityFieldsChanged =
    'slot_time' in patch || 'party_size' in patch || 'zone_id' in patch || 'table_ids' in patch;

  const effectiveSlotTimeIso = patch.slot_time ?? booking.slot_time;
  const effectivePartySize = patch.party_size ?? booking.party_size;
  const effectiveZoneId = patch.zone_id ?? booking.zone_id;
  const effectiveTableIds = patch.table_ids ?? currentTableIds;
  const durationMinutes = booking.duration_minutes;

  let lock: { ok: true; token: string } | null = null;

  try {
    if (capacityFieldsChanged) {
      const configResult = await loadBookingConfig(restaurant.slug);
      if (!configResult.ok) {
        return NextResponse.json({ error: 'restaurant_not_found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
      }
      const config = configResult.config;

      const acquired = await acquireSlotLock(restaurant.id, effectiveSlotTimeIso);
      if (!acquired.ok) {
        return NextResponse.json({ error: 'slot_temporarily_busy' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
      }
      lock = acquired;

      const dateLocal = amsterdamCivilDate(new Date(effectiveSlotTimeIso));
      const inputs = await loadAvailabilityInputs(config, dateLocal);

      // 2. zone_id ownership.
      const zoneIds = new Set(inputs.zones.map((z) => z.id));
      if (patch.zone_id && !zoneIds.has(patch.zone_id)) {
        return NextResponse.json({ error: 'invalid_body' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
      }

      // 3. table_ids ownership + zone membership.
      const zoneForTables = inputs.zones.find((z) => z.id === effectiveZoneId);
      const tableSeatsById = new Map<string, number>();
      for (const zone of inputs.zones) {
        for (const table of zone.tables) tableSeatsById.set(table.id, table.seats);
      }
      if (patch.table_ids) {
        const validTableIds = new Set((zoneForTables?.tables ?? []).map((t) => t.id));
        if (!patch.table_ids.every((id) => validTableIds.has(id))) {
          return NextResponse.json({ error: 'invalid_body' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
        }
      }

      // 4. Availability window for the (possibly new) date — weekly rows or
      //    an availability_exceptions override, whichever applies.
      if (patch.slot_time) {
        const windows = await getServiceWindowsForDay(restaurant.id, dateLocal);
        const newStartMs = new Date(effectiveSlotTimeIso).getTime();
        const newEndMs = newStartMs + durationMinutes * 60_000;
        const fits = windows.some((w) => {
          const openMs = new Date(w.open_utc).getTime();
          const closeMs = new Date(w.close_utc).getTime();
          return newStartMs >= openMs && newEndMs <= closeMs;
        });
        if (!fits) {
          return NextResponse.json({ error: 'outside_availability' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
        }
      }

      // 5. Half-full rule: party_size * 2 >= sum(seats) >= party_size.
      const totalSeats = effectiveTableIds.reduce((sum, id) => sum + (tableSeatsById.get(id) ?? 0), 0);
      if (totalSeats < effectivePartySize || totalSeats > effectivePartySize * 2) {
        return NextResponse.json({ error: 'half_full_violated' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
      }

      // 6. Overlap check against every other active booking.
      const bufferMs = config.turnoverBufferMinutes * 60_000;
      const newStartMs = new Date(effectiveSlotTimeIso).getTime();
      const newEndMs = newStartMs + durationMinutes * 60_000;
      const otherBookings = inputs.existingBookings.filter((b) => b.id !== bookingId);
      const conflict = effectiveTableIds.some((tableId) =>
        tableBlockedAt(tableId, newStartMs, newEndMs, bufferMs, otherBookings),
      );
      if (conflict) {
        return NextResponse.json({ error: 'table_conflict' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
      }
    }

    const fieldsToWrite: Record<string, unknown> = {};
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (patch.slot_time !== undefined && patch.slot_time !== booking.slot_time) {
      fieldsToWrite.slot_time = patch.slot_time;
      changes.slot_time = { from: booking.slot_time, to: patch.slot_time };
    }
    if (patch.party_size !== undefined && patch.party_size !== booking.party_size) {
      fieldsToWrite.party_size = patch.party_size;
      changes.party_size = { from: booking.party_size, to: patch.party_size };
    }
    if (patch.zone_id !== undefined && patch.zone_id !== booking.zone_id) {
      fieldsToWrite.zone_id = patch.zone_id;
      changes.zone_id = { from: booking.zone_id, to: patch.zone_id };
    }
    if (patch.guest_note !== undefined && patch.guest_note !== booking.guest_note) {
      fieldsToWrite.guest_note = patch.guest_note;
      changes.guest_note = { from: booking.guest_note, to: patch.guest_note };
    }
    const tableIdsChanged =
      patch.table_ids !== undefined &&
      (patch.table_ids.length !== currentTableIds.length ||
        !patch.table_ids.every((id) => currentTableIds.includes(id)));
    if (tableIdsChanged) {
      changes.table_ids = { from: currentTableIds, to: patch.table_ids };
    }

    if (Object.keys(fieldsToWrite).length === 0 && !tableIdsChanged) {
      return NextResponse.json({ error: 'no_changes' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }

    const { data: updated, error: updateError } = await admin
      .from('bookings')
      .update(fieldsToWrite)
      .eq('id', bookingId)
      .eq('restaurant_id', restaurant.id)
      .eq('status', booking.status)
      .select('id, status, slot_time, party_size, zone_id, guest_note, updated_at')
      .maybeSingle();

    if (updateError) {
      console.error('[bookings/edit] update failed', updateError.message);
      return NextResponse.json({ error: 'update_failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }
    if (!updated) {
      return NextResponse.json({ error: 'terminal_state' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
    }

    if (tableIdsChanged && patch.table_ids) {
      await admin.from('booking_tables').delete().eq('booking_id', bookingId);
      const { error: btError } = await admin
        .from('booking_tables')
        .insert(patch.table_ids.map((tableId) => ({ booking_id: bookingId, table_id: tableId })));
      if (btError) {
        console.error('[bookings/edit] booking_tables update failed', btError.message);
      }
    }

    await dashboardAudit({
      restaurantId: restaurant.id,
      staffId: guard.staff.id,
      eventType: 'booking.edited',
      eventData: { changes },
      bookingId,
    });

    invalidateConsumerPage(restaurant.slug);

    return NextResponse.json({ ok: true, booking: updated }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
  } finally {
    if (lock) {
      await releaseSlotLock(lock.token, restaurant.id, effectiveSlotTimeIso);
    }
  }
}
