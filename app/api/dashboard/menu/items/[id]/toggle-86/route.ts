// app/api/dashboard/menu/items/[id]/toggle-86/route.ts
//
// POST /api/dashboard/menu/items/{id}/toggle-86
// Body: { available: boolean }
//
// Its own route rather than a field on update: during service a cook wants
// to 86 a dish in one tap, without loading (and re-submitting) every other
// field of the item. Also its own permission key, `menu.item.86`, which
// D8.2 can grant to kitchen staff who shouldn't be editing prices.
//
// The guest-facing half of this is already complete and untouched here:
// fetchMenu filters `available = true`, and both order-create paths reject
// unavailable lines with `not_available`.

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { invalidateConsumerPage, invalidateMenu } from '@/lib/consumer/cache';
import { resolveMenuMutationContext } from '@/lib/dashboard/menu/resolveMenuMutationContext';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: itemId } = await ctx.params;

  const resolved = await resolveMenuMutationContext('menu.item.86');
  if (!resolved.ok) return resolved.response;
  const { supabase, restaurant, staff } = resolved.ctx;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400, headers: NO_STORE });
  }
  const available = (rawBody as { available?: unknown })?.available;
  if (typeof available !== 'boolean') {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400, headers: NO_STORE });
  }

  const { data: item } = await supabase
    .from('menu_items')
    .select('id, available')
    .eq('id', itemId)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle();
  if (!item) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
  }

  // Idempotent: re-asserting the current state is a success, not an error,
  // and writes no audit noise.
  if (item.available === available) {
    return NextResponse.json({ ok: true, changed: false }, { status: 200, headers: NO_STORE });
  }

  const admin = await createSupabaseServerClientAdmin();
  const { data: updated, error: updateError } = await admin
    .from('menu_items')
    .update({ available })
    .eq('id', itemId)
    .eq('restaurant_id', restaurant.id)
    .select('id, available')
    .maybeSingle();

  if (updateError) {
    console.error('[menu/items/toggle-86] update failed', updateError);
    return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE });
  }
  if (!updated) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
  }

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: staff.id,
    eventType: 'menu.item.availability_changed',
    eventData: { item_id: itemId, from: !available, to: available },
  });

  invalidateConsumerPage(restaurant.slug);
  invalidateMenu(restaurant.id);

  return NextResponse.json({ ok: true, item: updated, changed: true }, { status: 200, headers: NO_STORE });
}
