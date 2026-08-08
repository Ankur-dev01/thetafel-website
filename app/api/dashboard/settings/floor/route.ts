// app/api/dashboard/settings/floor/route.ts
//
// POST /api/dashboard/settings/floor
// Body: FloorSavePayload (see lib/dashboard/settings/floorPlanValidation.ts)
//
// First dashboard write path to `zones` / `restaurant_tables` — every other
// mutation to these tables lives under the onboarding-only `/api/v1/...`
// routes, gated by `assertOnboardingMutationForUser`. This route is
// independent of that gate and only ever touches the caller's own
// restaurant (resolveMenuMutationContext), same as every other D-series
// dashboard mutation route.
//
// Soft-delete only: `restaurant_tables.deleted_at` is set, never a hard
// DELETE — `booking_tables.table_id` has ON DELETE CASCADE, so a hard
// delete would silently erase historical booking-table associations for any
// past booking that ever used the table, not just future ones. Matches the
// convention onboarding's draft route already established.

import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { invalidateConsumerPage } from '@/lib/consumer/cache';
import { resolveMenuMutationContext } from '@/lib/dashboard/menu/resolveMenuMutationContext';
import { parseFloorSavePayload, validateFloorSavePayload } from '@/lib/dashboard/settings/floorPlanValidation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function POST(req: NextRequest) {
  const resolved = await resolveMenuMutationContext('settings.floor.edit');
  if (!resolved.ok) return resolved.response;
  const { restaurant, staff } = resolved.ctx;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400, headers: NO_STORE });
  }

  const payload = parseFloorSavePayload(rawBody);
  if (!payload) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400, headers: NO_STORE });
  }

  const admin = await createSupabaseServerClientAdmin();

  const [{ data: existingZones, error: zonesLoadError }, { data: existingTables, error: tablesLoadError }] =
    await Promise.all([
      admin.from('zones').select('id, name').eq('restaurant_id', restaurant.id).is('deleted_at', null),
      admin
        .from('restaurant_tables')
        .select('id, label')
        .eq('restaurant_id', restaurant.id)
        .is('deleted_at', null),
    ]);
  if (zonesLoadError || tablesLoadError) {
    console.error('[settings/floor] existing rows load failed', zonesLoadError ?? tablesLoadError);
    return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE });
  }

  const knownZoneIds = new Set((existingZones ?? []).map((z) => z.id as string));
  const knownTableIds = new Set((existingTables ?? []).map((t) => t.id as string));
  const labelById = new Map((existingTables ?? []).map((t) => [t.id as string, t.label as string]));

  const errors = validateFloorSavePayload(payload, { knownZoneIds, knownTableIds });
  if (errors.length > 0) {
    return NextResponse.json({ error: 'validation_error', errors }, { status: 400, headers: NO_STORE });
  }

  const { zones, tables, deletedTableIds } = payload;

  // Deletion safety check: a table with an upcoming confirmed/pending
  // booking can't be soft-deleted — the guest would arrive to a missing
  // table. Zero writes happen below if this check fails.
  if (deletedTableIds.length > 0) {
    const { data: blockedRows, error: blockedError } = await admin
      .from('booking_tables')
      .select('table_id, bookings!inner(status, slot_time, restaurant_id)')
      .in('table_id', deletedTableIds)
      .eq('bookings.restaurant_id', restaurant.id)
      .in('bookings.status', ['pending', 'confirmed'])
      .gte('bookings.slot_time', new Date().toISOString());
    if (blockedError) {
      console.error('[settings/floor] deletion safety check failed', blockedError);
      return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE });
    }
    const blockedIds = Array.from(new Set((blockedRows ?? []).map((r) => r.table_id as string)));
    if (blockedIds.length > 0) {
      const blockedTableNames = blockedIds.map((id) => labelById.get(id) ?? id);
      return NextResponse.json(
        { error: 'table_has_future_bookings', blockedTableIds: blockedIds, blockedTableNames },
        { status: 409, headers: NO_STORE },
      );
    }
  }

  if (deletedTableIds.length > 0) {
    const { error } = await admin
      .from('restaurant_tables')
      .update({ deleted_at: new Date().toISOString() })
      .in('id', deletedTableIds)
      .eq('restaurant_id', restaurant.id);
    if (error) {
      console.error('[settings/floor] soft-delete failed', error);
      return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE });
    }
  }

  for (const zone of zones) {
    const { error } = await admin
      .from('zones')
      .update({ name: zone.name.trim(), display_order: zone.display_order })
      .eq('id', zone.id)
      .eq('restaurant_id', restaurant.id);
    if (error) {
      console.error('[settings/floor] zone update failed', { id: zone.id, error });
      return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE });
    }
  }

  const existingTablePatches = tables.filter((t) => t.id !== null);
  for (const table of existingTablePatches) {
    const { error } = await admin
      .from('restaurant_tables')
      .update({
        zone_id: table.zone_id,
        label: table.label.trim(),
        seats: table.seats,
        is_bookable: table.is_bookable,
        is_qr_enabled: table.is_qr_enabled,
      })
      .eq('id', table.id as string)
      .eq('restaurant_id', restaurant.id);
    if (error) {
      console.error('[settings/floor] table update failed', { id: table.id, error });
      return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE });
    }
  }

  const newTablePatches = tables.filter((t) => t.id === null);
  let addedIds: string[] = [];
  if (newTablePatches.length > 0) {
    const insertRows = newTablePatches.map((table) => ({
      restaurant_id: restaurant.id,
      zone_id: table.zone_id,
      label: table.label.trim(),
      seats: table.seats,
      is_bookable: table.is_bookable,
      // No printed QR code exists yet for a dashboard-added table — force
      // off regardless of what the client sent, so a restaurant can't think
      // guests can scan a code that was never generated.
      is_qr_enabled: false,
      qr_token: randomUUID(),
      qr_image_path: null,
    }));
    const { data: inserted, error } = await admin.from('restaurant_tables').insert(insertRows).select('id');
    if (error || !inserted) {
      console.error('[settings/floor] table insert failed', error);
      return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE });
    }
    addedIds = inserted.map((row) => row.id as string);
  }

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: staff.id,
    eventType: 'settings.floor.edit',
    eventData: {
      added: newTablePatches.length,
      updated: existingTablePatches.length,
      deleted: deletedTableIds.length,
      zones: zones.map((z) => z.name.trim()),
    },
  });

  invalidateConsumerPage(restaurant.slug);

  return NextResponse.json(
    { ok: true, ids: { added: addedIds, updated: existingTablePatches.map((t) => t.id as string) } },
    { status: 200, headers: NO_STORE },
  );
}
