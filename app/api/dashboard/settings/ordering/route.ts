// app/api/dashboard/settings/ordering/route.ts
//
// POST /api/dashboard/settings/ordering
// Body: OrderingPayload (see lib/dashboard/settings/orderingValidation.ts)
//
// First dashboard write path to these `restaurants` columns — onboarding's
// `ordering` step (via `/api/v1/restaurants/draft`, onboarding-status-only)
// is the only other writer. `service_takeaway_enabled` is read-only here:
// re-fetched fresh on every save and used purely as a gate, never written.

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { invalidateConsumerPage } from '@/lib/consumer/cache';
import { resolveMenuMutationContext } from '@/lib/dashboard/menu/resolveMenuMutationContext';
import {
  parseOrderingPayload,
  validateOrderingPayload,
  type OrderingPayload,
} from '@/lib/dashboard/settings/orderingValidation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

const WRITE_COLUMNS = [
  'takeaway_prep_time_minutes',
  'takeaway_min_order_cents',
  'takeaway_slot_interval_minutes',
  'takeaway_accepting_orders',
  'takeaway_item_notes_allowed',
  'takeaway_scheduled_orders_allowed',
] as const satisfies readonly (keyof OrderingPayload)[];

type CurrentRow = Record<(typeof WRITE_COLUMNS)[number], unknown> & {
  service_takeaway_enabled: boolean;
};

export async function POST(req: NextRequest) {
  const resolved = await resolveMenuMutationContext('settings.ordering.edit');
  if (!resolved.ok) return resolved.response;
  const { restaurant, staff } = resolved.ctx;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400, headers: NO_STORE });
  }

  const payload = parseOrderingPayload(rawBody);
  if (!payload) {
    return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400, headers: NO_STORE });
  }

  const admin = await createSupabaseServerClientAdmin();

  const { data: current, error: loadError } = await admin
    .from('restaurants')
    .select(
      'takeaway_prep_time_minutes, takeaway_min_order_cents, takeaway_slot_interval_minutes, takeaway_accepting_orders, takeaway_item_notes_allowed, takeaway_scheduled_orders_allowed, service_takeaway_enabled',
    )
    .eq('id', restaurant.id)
    .single<CurrentRow>();
  if (loadError || !current) {
    console.error('[settings/ordering] current row load failed', loadError);
    return NextResponse.json({ ok: false, code: 'db_error' }, { status: 500, headers: NO_STORE });
  }

  const validationError = validateOrderingPayload(payload, {
    serviceTakeawayEnabled: current.service_takeaway_enabled,
  });
  if (validationError) {
    const status = validationError.code === 'takeaway_not_enabled' ? 409 : 400;
    return NextResponse.json({ ok: false, ...validationError }, { status, headers: NO_STORE });
  }

  const update: Record<string, unknown> = {};
  const fieldsChanged: string[] = [];
  for (const column of WRITE_COLUMNS) {
    update[column] = payload[column];
    if ((current as Record<string, unknown>)[column] !== payload[column]) {
      fieldsChanged.push(column);
    }
  }

  const { error: updateError } = await admin.from('restaurants').update(update).eq('id', restaurant.id);
  if (updateError) {
    console.error('[settings/ordering] update failed', updateError);
    return NextResponse.json({ ok: false, code: 'db_error' }, { status: 500, headers: NO_STORE });
  }

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: staff.id,
    eventType: 'settings.ordering.edit',
    eventData: { fields_changed: fieldsChanged },
  });

  invalidateConsumerPage(restaurant.slug);

  return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
}
