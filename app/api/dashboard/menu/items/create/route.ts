// app/api/dashboard/menu/items/create/route.ts
//
// POST /api/dashboard/menu/items/create
// Body: ItemPatch
//
// display_order is server-assigned as MAX+1 within the target category —
// create always appends, the client never proposes a position. Item ordering
// is scoped per category (live data has both 0-based and 1-based categories,
// so append-at-max is the only safe assignment; the first reorder normalises).
//
// `currency` is omitted deliberately: the column is NOT NULL DEFAULT 'EUR'.

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { invalidateConsumerPage, invalidateMenu } from '@/lib/consumer/cache';
import { resolveMenuMutationContext } from '@/lib/dashboard/menu/resolveMenuMutationContext';
import { parseItemPatchBody, normalizeItemPatch, validateItemPatch } from '@/lib/dashboard/menu/itemValidation';
import { normalizeDietaryTags } from '@/lib/dashboard/menu/normalizeTags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function POST(req: NextRequest) {
  const resolved = await resolveMenuMutationContext('menu.item.create');
  if (!resolved.ok) return resolved.response;
  const { supabase, restaurant, staff } = resolved.ctx;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400, headers: NO_STORE });
  }

  const parsed = parseItemPatchBody(rawBody);
  if (!parsed) return NextResponse.json({ error: 'invalid_body' }, { status: 400, headers: NO_STORE });

  const patch = normalizeItemPatch({ ...parsed, dietary_tags: normalizeDietaryTags(parsed.dietary_tags) });
  const errors = validateItemPatch(patch);
  if (errors.length > 0) {
    return NextResponse.json({ error: 'invalid_body', errors }, { status: 400, headers: NO_STORE });
  }

  const { data: category } = await supabase
    .from('menu_categories')
    .select('id')
    .eq('id', patch.category_id)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle();
  if (!category) {
    return NextResponse.json({ error: 'unknown_category' }, { status: 400, headers: NO_STORE });
  }

  const { data: last, error: maxError } = await supabase
    .from('menu_items')
    .select('display_order')
    .eq('restaurant_id', restaurant.id)
    .eq('category_id', patch.category_id)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxError) {
    console.error('[menu/items/create] max display_order lookup failed', maxError);
    return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE });
  }
  const nextDisplayOrder = last ? (last.display_order ?? -1) + 1 : 0;

  const admin = await createSupabaseServerClientAdmin();
  const { data: inserted, error: insertError } = await admin
    .from('menu_items')
    .insert({
      restaurant_id: restaurant.id,
      category_id: patch.category_id,
      name_nl: patch.name_nl,
      name_en: patch.name_en,
      description_nl: patch.description_nl,
      description_en: patch.description_en,
      price_cents: patch.price_cents,
      vat_rate_bp: patch.vat_rate_bp,
      dietary_tags: patch.dietary_tags,
      visible_takeaway: patch.visible_takeaway,
      visible_qr: patch.visible_qr,
      available: patch.available,
      display_order: nextDisplayOrder,
    })
    .select('id, category_id, name_nl, display_order')
    .single();

  if (insertError || !inserted) {
    console.error('[menu/items/create] insert failed', insertError);
    return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE });
  }

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: staff.id,
    eventType: 'menu.item.created',
    eventData: {
      item_id: inserted.id,
      category_id: inserted.category_id,
      name_nl: inserted.name_nl,
      display_order: inserted.display_order,
    },
  });

  invalidateConsumerPage(restaurant.slug);
  invalidateMenu(restaurant.id);

  return NextResponse.json({ ok: true, item: inserted }, { status: 200, headers: NO_STORE });
}
