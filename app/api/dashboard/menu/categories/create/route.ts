// app/api/dashboard/menu/categories/create/route.ts
//
// POST /api/dashboard/menu/categories/create
// Body: CategoryPatch
//
// display_order is server-assigned as MAX + 1 (0 when the restaurant has no
// categories yet) — the client never proposes a position, create always
// appends. Live data contains both 0-based and 1-based orderings because
// nothing ever wrote these rows before D4.2; append-at-max is correct under
// either, and the first reorder normalises the whole set to 0-based.

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { invalidateConsumerPage, invalidateMenu } from '@/lib/consumer/cache';
import { resolveMenuMutationContext } from '@/lib/dashboard/menu/resolveMenuMutationContext';
import {
  parseCategoryPatchBody,
  normalizeCategoryPatch,
  validateCategoryPatch,
} from '@/lib/dashboard/menu/categoryValidation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function POST(req: NextRequest) {
  const resolved = await resolveMenuMutationContext('menu.category.create');
  if (!resolved.ok) return resolved.response;
  const { supabase, restaurant, staff } = resolved.ctx;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400, headers: NO_STORE });
  }

  const parsed = parseCategoryPatchBody(rawBody);
  if (!parsed) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400, headers: NO_STORE });
  }
  const patch = normalizeCategoryPatch(parsed);
  const errors = validateCategoryPatch(patch);
  if (errors.length > 0) {
    return NextResponse.json({ error: 'invalid_body', errors }, { status: 400, headers: NO_STORE });
  }

  const { data: existing, error: maxError } = await supabase
    .from('menu_categories')
    .select('display_order')
    .eq('restaurant_id', restaurant.id)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (maxError) {
    console.error('[menu/categories/create] max display_order lookup failed', maxError);
    return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE });
  }
  const nextDisplayOrder = existing ? (existing.display_order ?? -1) + 1 : 0;

  const admin = await createSupabaseServerClientAdmin();
  const { data: inserted, error: insertError } = await admin
    .from('menu_categories')
    .insert({
      restaurant_id: restaurant.id,
      name_nl: patch.name_nl,
      name_en: patch.name_en,
      display_order: nextDisplayOrder,
      window_start: patch.window_start,
      window_end: patch.window_end,
      visible_takeaway: patch.visible_takeaway,
      visible_qr: patch.visible_qr,
    })
    .select('id, name_nl, name_en, display_order, window_start, window_end, visible_takeaway, visible_qr')
    .single();

  if (insertError || !inserted) {
    console.error('[menu/categories/create] insert failed', insertError);
    return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE });
  }

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: staff.id,
    eventType: 'menu.category.created',
    eventData: {
      category_id: inserted.id,
      name_nl: inserted.name_nl,
      display_order: inserted.display_order,
    },
  });

  invalidateConsumerPage(restaurant.slug);
  invalidateMenu(restaurant.id);

  return NextResponse.json({ ok: true, category: inserted }, { status: 200, headers: NO_STORE });
}
