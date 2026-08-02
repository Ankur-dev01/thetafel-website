// app/api/dashboard/menu/categories/reorder/route.ts
//
// POST /api/dashboard/menu/categories/reorder
// Body: { ordered_ids: string[] }
//
// Full dense renumber, never a swap: the client sends every category id in
// its new order and the server rewrites each row's display_order to that
// id's index. This is what normalises the live data — nothing wrote these
// rows before D4.2, so some restaurants sit at 0-based and others at 1-based;
// the first reorder brings everyone to dense 0-based.
//
// The array must be a TOTAL order (every category, exactly once). A partial
// array is rejected rather than interpreted, because there is no sane way to
// place the omitted categories.

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { invalidateConsumerPage, invalidateMenu } from '@/lib/consumer/cache';
import { resolveMenuMutationContext } from '@/lib/dashboard/menu/resolveMenuMutationContext';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;
const MAX_CATEGORIES = 50;

export async function POST(req: NextRequest) {
  const resolved = await resolveMenuMutationContext('menu.category.reorder');
  if (!resolved.ok) return resolved.response;
  const { supabase, restaurant, staff } = resolved.ctx;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400, headers: NO_STORE });
  }

  const orderedIds = (rawBody as { ordered_ids?: unknown })?.ordered_ids;
  if (
    !Array.isArray(orderedIds) ||
    orderedIds.length === 0 ||
    orderedIds.length > MAX_CATEGORIES ||
    !orderedIds.every((id) => typeof id === 'string' && id.length > 0)
  ) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400, headers: NO_STORE });
  }
  const ids = orderedIds as string[];

  if (new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: 'duplicate_id' }, { status: 400, headers: NO_STORE });
  }

  const { data: existing, error: loadError } = await supabase
    .from('menu_categories')
    .select('id')
    .eq('restaurant_id', restaurant.id);
  if (loadError) {
    console.error('[menu/categories/reorder] category load failed', loadError);
    return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE });
  }

  const owned = new Set((existing ?? []).map((row) => row.id as string));
  const unknownId = ids.find((id) => !owned.has(id));
  if (unknownId) {
    return NextResponse.json(
      { error: 'unknown_category', category_id: unknownId },
      { status: 400, headers: NO_STORE },
    );
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
      .from('menu_categories')
      .update({ display_order: index })
      .eq('id', ids[index])
      .eq('restaurant_id', restaurant.id);
    if (error) {
      console.error('[menu/categories/reorder] update failed', { id: ids[index], index, error });
      return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE });
    }
  }

  const newOrder = ids.map((id, index) => ({ id, display_order: index }));

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: staff.id,
    eventType: 'menu.category.reordered',
    eventData: { new_order: newOrder },
  });

  invalidateConsumerPage(restaurant.slug);
  invalidateMenu(restaurant.id);

  return NextResponse.json({ ok: true, categories: newOrder }, { status: 200, headers: NO_STORE });
}
