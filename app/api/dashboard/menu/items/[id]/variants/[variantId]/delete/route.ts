// app/api/dashboard/menu/items/[id]/variants/[variantId]/delete/route.ts
//
// POST /api/dashboard/menu/items/{id}/variants/{variantId}/delete
// Body: {} — nothing to send.

import { NextResponse } from 'next/server';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { invalidateConsumerPage, invalidateMenu } from '@/lib/consumer/cache';
import { resolveMenuMutationContext } from '@/lib/dashboard/menu/resolveMenuMutationContext';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string; variantId: string }> }) {
  const { id: itemId, variantId } = await ctx.params;

  const resolved = await resolveMenuMutationContext('menu.item.edit');
  if (!resolved.ok) return resolved.response;
  const { supabase, restaurant, staff } = resolved.ctx;

  const { data: item } = await supabase
    .from('menu_items')
    .select('id')
    .eq('id', itemId)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle();
  if (!item) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
  }

  const { data: variant } = await supabase
    .from('menu_item_variants')
    .select('id, name_nl')
    .eq('id', variantId)
    .eq('item_id', itemId)
    .maybeSingle();
  if (!variant) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
  }

  const admin = await createSupabaseServerClientAdmin();
  const { error: deleteError } = await admin
    .from('menu_item_variants')
    .delete()
    .eq('id', variantId)
    .eq('item_id', itemId);
  if (deleteError) {
    console.error('[menu/variants/delete] delete failed', deleteError);
    return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE });
  }

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: staff.id,
    eventType: 'menu.variant.deleted',
    eventData: { item_id: itemId, variant_id: variantId, name_nl: variant.name_nl },
  });

  invalidateConsumerPage(restaurant.slug);
  invalidateMenu(restaurant.id);

  return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
}
