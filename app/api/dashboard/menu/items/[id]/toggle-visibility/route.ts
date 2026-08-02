// app/api/dashboard/menu/items/[id]/toggle-visibility/route.ts
//
// POST /api/dashboard/menu/items/{id}/toggle-visibility
// Body: { visible_takeaway?: boolean, visible_qr?: boolean } — one or both.
//
// Separate from 86: visibility answers "does this belong on that menu at
// all", availability answers "can we cook it right now". Both are per-item
// and independent — unlike a category, hiding one item never affects its
// siblings (fetchMenu filters items individually).

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

  const resolved = await resolveMenuMutationContext('menu.item.toggle_visibility');
  if (!resolved.ok) return resolved.response;
  const { supabase, restaurant, staff } = resolved.ctx;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400, headers: NO_STORE });
  }
  const body = rawBody as { visible_takeaway?: unknown; visible_qr?: unknown };
  const wantsTakeaway = body?.visible_takeaway;
  const wantsQr = body?.visible_qr;

  if (
    (wantsTakeaway === undefined && wantsQr === undefined) ||
    (wantsTakeaway !== undefined && typeof wantsTakeaway !== 'boolean') ||
    (wantsQr !== undefined && typeof wantsQr !== 'boolean')
  ) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400, headers: NO_STORE });
  }

  const { data: item } = await supabase
    .from('menu_items')
    .select('id, visible_takeaway, visible_qr')
    .eq('id', itemId)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle();
  if (!item) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
  }

  const update: Record<string, boolean> = {};
  const changes: Record<string, { from: boolean; to: boolean }> = {};
  if (typeof wantsTakeaway === 'boolean' && wantsTakeaway !== item.visible_takeaway) {
    update.visible_takeaway = wantsTakeaway;
    changes.visible_takeaway = { from: item.visible_takeaway, to: wantsTakeaway };
  }
  if (typeof wantsQr === 'boolean' && wantsQr !== item.visible_qr) {
    update.visible_qr = wantsQr;
    changes.visible_qr = { from: item.visible_qr, to: wantsQr };
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ ok: true, changed: false }, { status: 200, headers: NO_STORE });
  }

  const admin = await createSupabaseServerClientAdmin();
  const { data: updated, error: updateError } = await admin
    .from('menu_items')
    .update(update)
    .eq('id', itemId)
    .eq('restaurant_id', restaurant.id)
    .select('id, visible_takeaway, visible_qr')
    .maybeSingle();

  if (updateError) {
    console.error('[menu/items/toggle-visibility] update failed', updateError);
    return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE });
  }
  if (!updated) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
  }

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: staff.id,
    eventType: 'menu.item.visibility_changed',
    eventData: { item_id: itemId, changes },
  });

  invalidateConsumerPage(restaurant.slug);
  invalidateMenu(restaurant.id);

  return NextResponse.json({ ok: true, item: updated, changed: true }, { status: 200, headers: NO_STORE });
}
