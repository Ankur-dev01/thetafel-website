// app/api/dashboard/menu/items/reorder/route.ts
//
// POST /api/dashboard/menu/items/reorder
// Body: { category_id: string, ordered_ids: string[] }
//
// Scoped to ONE category — item display_order is relative to its category,
// so a reorder never spans two. Like the category reorder, the array must be
// a total order over that category's items and the server rewrites every row
// to its index (full dense renumber, not a swap), which also normalises the
// 0-based/1-based split that exists in live data.

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { invalidateConsumerPage, invalidateMenu } from '@/lib/consumer/cache';
import { resolveMenuMutationContext } from '@/lib/dashboard/menu/resolveMenuMutationContext';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;
const MAX_ITEMS = 100;

export async function POST(req: NextRequest) {
  const resolved = await resolveMenuMutationContext('menu.item.reorder');
  if (!resolved.ok) return resolved.response;
  const { supabase, restaurant, staff } = resolved.ctx;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400, headers: NO_STORE });
  }

  const body = rawBody as { category_id?: unknown; ordered_ids?: unknown };
  const categoryId = body?.category_id;
  const orderedIds = body?.ordered_ids;

  if (
    typeof categoryId !== 'string' ||
    categoryId.length === 0 ||
    !Array.isArray(orderedIds) ||
    orderedIds.length === 0 ||
    orderedIds.length > MAX_ITEMS ||
    !orderedIds.every((id) => typeof id === 'string' && id.length > 0)
  ) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400, headers: NO_STORE });
  }
  const ids = orderedIds as string[];

  if (new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: 'duplicate_id' }, { status: 400, headers: NO_STORE });
  }

  const { data: category } = await supabase
    .from('menu_categories')
    .select('id')
    .eq('id', categoryId)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle();
  if (!category) {
    return NextResponse.json({ error: 'unknown_category' }, { status: 400, headers: NO_STORE });
  }

  const { data: existing, error: loadError } = await supabase
    .from('menu_items')
    .select('id')
    .eq('restaurant_id', restaurant.id)
    .eq('category_id', categoryId);
  if (loadError) {
    console.error('[menu/items/reorder] item load failed', loadError);
    return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE });
  }

  const owned = new Set((existing ?? []).map((row) => row.id as string));
  const unknownId = ids.find((id) => !owned.has(id));
  if (unknownId) {
    return NextResponse.json({ error: 'unknown_item', item_id: unknownId }, { status: 400, headers: NO_STORE });
  }
  if (ids.length !== owned.size) {
    return NextResponse.json(
      { error: 'incomplete_order', expected: owned.size, received: ids.length },
      { status: 400, headers: NO_STORE },
    );
  }

  const admin = await createSupabaseServerClientAdmin();
  for (let index = 0; index < ids.length; index++) {
    const { error } = await admin
      .from('menu_items')
      .update({ display_order: index })
      .eq('id', ids[index])
      .eq('restaurant_id', restaurant.id);
    if (error) {
      console.error('[menu/items/reorder] update failed', { id: ids[index], index, error });
      return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE });
    }
  }

  const newOrder = ids.map((id, index) => ({ id, display_order: index }));

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: staff.id,
    eventType: 'menu.item.reordered',
    eventData: { category_id: categoryId, new_order: newOrder },
  });

  invalidateConsumerPage(restaurant.slug);
  invalidateMenu(restaurant.id);

  return NextResponse.json({ ok: true, items: newOrder }, { status: 200, headers: NO_STORE });
}
