// app/api/dashboard/menu/categories/[id]/delete/route.ts
//
// POST /api/dashboard/menu/categories/{id}/delete
// Body: {} — nothing to send.
//
// Deleting a category that still has items is BLOCKED (409 has_items), and
// that guard is the whole point of this route. The FK is
// `menu_items_category_id_fkey ... ON DELETE SET NULL`, so letting a delete
// through would silently orphan the items — and orphans are invisible on the
// consumer surface (lib/menu/fetchMenu.ts skips rows with a null
// category_id) while remaining perfectly orderable by id through
// lib/orders/transactionalInsert.ts. Items that exist, can be bought, and
// nobody can see. We never let the FK fire.

import { NextResponse } from 'next/server';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { invalidateConsumerPage, invalidateMenu } from '@/lib/consumer/cache';
import { resolveMenuMutationContext } from '@/lib/dashboard/menu/resolveMenuMutationContext';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: categoryId } = await ctx.params;

  const resolved = await resolveMenuMutationContext('menu.category.delete');
  if (!resolved.ok) return resolved.response;
  const { supabase, restaurant, staff } = resolved.ctx;

  const { data: category } = await supabase
    .from('menu_categories')
    .select('id, name_nl')
    .eq('id', categoryId)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle();
  if (!category) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
  }

  const { count: itemCount, error: countError } = await supabase
    .from('menu_items')
    .select('id', { count: 'exact', head: true })
    .eq('category_id', categoryId)
    .eq('restaurant_id', restaurant.id);
  if (countError) {
    console.error('[menu/categories/delete] item count failed', countError);
    return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE });
  }
  if ((itemCount ?? 0) > 0) {
    return NextResponse.json(
      { error: 'has_items', item_count: itemCount ?? 0 },
      { status: 409, headers: NO_STORE },
    );
  }

  const admin = await createSupabaseServerClientAdmin();
  const { error: deleteError } = await admin
    .from('menu_categories')
    .delete()
    .eq('id', categoryId)
    .eq('restaurant_id', restaurant.id);
  if (deleteError) {
    console.error('[menu/categories/delete] delete failed', deleteError);
    return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE });
  }

  // Close the gap the delete left, so ordering stays dense and 0-based.
  const { data: remaining, error: remainingError } = await admin
    .from('menu_categories')
    .select('id, display_order')
    .eq('restaurant_id', restaurant.id)
    .order('display_order', { ascending: true });
  if (remainingError) {
    // The delete itself succeeded; a failed renumber leaves a harmless gap
    // that the next reorder normalises. Not worth failing the request.
    console.error('[menu/categories/delete] renumber lookup failed', remainingError);
  } else {
    const misplaced = (remaining ?? [])
      .map((row, index) => ({ id: row.id as string, index, current: row.display_order as number | null }))
      .filter((row) => row.current !== row.index);
    for (const row of misplaced) {
      const { error } = await admin
        .from('menu_categories')
        .update({ display_order: row.index })
        .eq('id', row.id)
        .eq('restaurant_id', restaurant.id);
      if (error) console.error('[menu/categories/delete] renumber failed', { id: row.id, error });
    }
  }

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: staff.id,
    eventType: 'menu.category.deleted',
    eventData: { category_id: categoryId, name_nl: category.name_nl },
  });

  invalidateConsumerPage(restaurant.slug);
  invalidateMenu(restaurant.id);

  return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
}
