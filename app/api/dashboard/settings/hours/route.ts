// app/api/dashboard/settings/hours/route.ts
//
// POST /api/dashboard/settings/hours
// Body: HoursSavePayload (see lib/dashboard/settings/hoursValidation.ts)
//
// Full week replace, not per-row CRUD: the client sends every enabled day as
// a row (closed days are simply omitted) and the server reconciles the
// `availability` table to exactly that set — deleting anything that fell out
// (closed days, dropped scopes on an override toggle) and upserting the rest.
// Mirrors the "send the whole thing back" pattern menu/categories/reorder uses.

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { invalidateConsumerPage } from '@/lib/consumer/cache';
import { resolveMenuMutationContext } from '@/lib/dashboard/menu/resolveMenuMutationContext';
import { parseHoursSavePayload, validateHoursSavePayload } from '@/lib/dashboard/settings/hoursValidation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function POST(req: NextRequest) {
  const resolved = await resolveMenuMutationContext('settings.hours.edit');
  if (!resolved.ok) return resolved.response;
  const { restaurant, staff } = resolved.ctx;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400, headers: NO_STORE });
  }

  const payload = parseHoursSavePayload(rawBody);
  if (!payload) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400, headers: NO_STORE });
  }

  const errors = validateHoursSavePayload(payload);
  if (errors.length > 0) {
    return NextResponse.json({ error: 'validation_error', errors }, { status: 400, headers: NO_STORE });
  }

  const admin = await createSupabaseServerClientAdmin();

  const { error: restaurantUpdateError } = await admin
    .from('restaurants')
    .update({ hours_per_service_override: payload.hoursPerServiceOverride })
    .eq('id', restaurant.id);
  if (restaurantUpdateError) {
    console.error('[settings/hours] restaurant flag update failed', restaurantUpdateError);
    return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE });
  }

  const { data: existingRows, error: loadError } = await admin
    .from('availability')
    .select('id, day_of_week, service_scope')
    .eq('restaurant_id', restaurant.id);
  if (loadError) {
    console.error('[settings/hours] existing rows load failed', loadError);
    return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE });
  }

  const incomingKeys = new Set(payload.rows.map((row) => `${row.day_of_week}:${row.service_scope}`));
  const staleIds = (existingRows ?? [])
    .filter((row) => !incomingKeys.has(`${row.day_of_week}:${row.service_scope}`))
    .map((row) => row.id as string);

  if (staleIds.length > 0) {
    const { error: deleteError } = await admin.from('availability').delete().in('id', staleIds);
    if (deleteError) {
      console.error('[settings/hours] stale row delete failed', deleteError);
      return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE });
    }
  }

  if (payload.rows.length > 0) {
    const upsertRows = payload.rows.map((row) => ({
      restaurant_id: restaurant.id,
      day_of_week: row.day_of_week,
      service_scope: row.service_scope,
      open_time: row.open_time,
      close_time: row.close_time,
      closes_next_day: row.closes_next_day,
      is_active: true,
      tag_brunch: row.tag_brunch,
      tag_lunch: row.tag_lunch,
      tag_dinner: row.tag_dinner,
    }));

    const { error: upsertError } = await admin
      .from('availability')
      .upsert(upsertRows, { onConflict: 'restaurant_id,day_of_week,service_scope' });
    if (upsertError) {
      console.error('[settings/hours] upsert failed', upsertError);
      return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE });
    }
  }

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: staff.id,
    eventType: 'settings.hours.update',
    eventData: {
      hoursPerServiceOverride: payload.hoursPerServiceOverride,
      rowCount: payload.rows.length,
      scopes: Array.from(new Set(payload.rows.map((row) => row.service_scope))),
    },
  });

  invalidateConsumerPage(restaurant.slug);

  return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
}
