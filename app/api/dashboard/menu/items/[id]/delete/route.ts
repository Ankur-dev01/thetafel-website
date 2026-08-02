// app/api/dashboard/menu/items/[id]/delete/route.ts
//
// POST /api/dashboard/menu/items/{id}/delete
// Body: {} — nothing to send.
//
// HARD delete, unlike categories (D4.2 blocks those while they hold items).
// That is safe here and the reasoning is worth stating plainly:
//
//   order_items is snapshot-based. name_snapshot, unit_price_cents, quantity,
//   line_total_cents and currency all live on the order row, and
//   order_items.menu_item_id is nullable with ON DELETE SET NULL. Dashboard
//   order/tab rendering reads name_snapshot and never joins back to
//   menu_items. So deleting an item leaves historical orders complete and
//   readable — only the "which live menu row was this" backlink is lost,
//   which costs future per-item sales analytics and nothing else.
//
// menu_item_variants cascade automatically (FK ON DELETE CASCADE).

import { NextResponse } from 'next/server';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { invalidateConsumerPage, invalidateMenu } from '@/lib/consumer/cache';
import { resolveMenuMutationContext } from '@/lib/dashboard/menu/resolveMenuMutationContext';
import { renumberCategoryItems } from '@/lib/dashboard/menu/renumberItems';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: itemId } = await ctx.params;

  const resolved = await resolveMenuMutationContext('menu.item.delete');
  if (!resolved.ok) return resolved.response;
  const { supabase, restaurant, staff } = resolved.ctx;

  const { data: item } = await supabase
    .from('menu_items')
    .select('id, category_id, name_nl')
    .eq('id', itemId)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle();
  if (!item) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
  }

  const admin = await createSupabaseServerClientAdmin();
  const { error: deleteError } = await admin
    .from('menu_items')
    .delete()
    .eq('id', itemId)
    .eq('restaurant_id', restaurant.id);
  if (deleteError) {
    console.error('[menu/items/delete] delete failed', deleteError);
    return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE });
  }

  if (item.category_id) {
    await renumberCategoryItems(admin, restaurant.id, item.category_id as string);
  }

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: staff.id,
    eventType: 'menu.item.deleted',
    eventData: {
      item_id: itemId,
      category_id: item.category_id,
      name_nl: item.name_nl,
      // Recorded so a later analytics gap is explainable rather than mysterious.
      order_history_note: 'order_items.menu_item_id set to NULL; name_snapshot preserves history',
    },
  });

  invalidateConsumerPage(restaurant.slug);
  invalidateMenu(restaurant.id);

  return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
}
