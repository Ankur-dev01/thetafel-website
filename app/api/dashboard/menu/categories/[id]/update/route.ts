// app/api/dashboard/menu/categories/[id]/update/route.ts
//
// POST /api/dashboard/menu/categories/{id}/update
// Body: CategoryPatch
//
// Full overwrite of the user-editable fields — no monotonic guard, because
// unlike a status transition there is no illegal direction to move in; last
// write wins, which is what an edit form means. display_order is NOT
// editable here; ordering is the reorder route's job.

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { invalidateConsumerPage, invalidateMenu } from '@/lib/consumer/cache';
import { resolveMenuMutationContext } from '@/lib/dashboard/menu/resolveMenuMutationContext';
import {
  parseCategoryPatchBody,
  normalizeCategoryPatch,
  validateCategoryPatch,
  type CategoryPatch,
} from '@/lib/dashboard/menu/categoryValidation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

const DIFFED_FIELDS: (keyof CategoryPatch)[] = [
  'name_nl',
  'name_en',
  'window_start',
  'window_end',
  'visible_takeaway',
  'visible_qr',
];

/** `time` columns come back as 'HH:MM:SS'; the patch carries 'HH:MM'. Compare on the shared prefix so an unchanged window doesn't look edited. */
function sameValue(field: keyof CategoryPatch, before: unknown, after: unknown): boolean {
  if (field === 'window_start' || field === 'window_end') {
    const b = typeof before === 'string' ? before.slice(0, 5) : before;
    const a = typeof after === 'string' ? after.slice(0, 5) : after;
    return b === a;
  }
  return before === after;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: categoryId } = await ctx.params;

  const resolved = await resolveMenuMutationContext('menu.category.edit');
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

  const { data: current } = await supabase
    .from('menu_categories')
    .select('id, name_nl, name_en, window_start, window_end, visible_takeaway, visible_qr, display_order')
    .eq('id', categoryId)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle();
  if (!current) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
  }

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of DIFFED_FIELDS) {
    const before = (current as Record<string, unknown>)[field];
    const after = patch[field];
    if (!sameValue(field, before, after)) {
      changes[field] = { from: before, to: after };
    }
  }

  const admin = await createSupabaseServerClientAdmin();
  const { data: updated, error: updateError } = await admin
    .from('menu_categories')
    .update({
      name_nl: patch.name_nl,
      name_en: patch.name_en,
      window_start: patch.window_start,
      window_end: patch.window_end,
      visible_takeaway: patch.visible_takeaway,
      visible_qr: patch.visible_qr,
    })
    .eq('id', categoryId)
    .eq('restaurant_id', restaurant.id)
    .select('id, name_nl, name_en, display_order, window_start, window_end, visible_takeaway, visible_qr')
    .maybeSingle();

  if (updateError) {
    console.error('[menu/categories/update] update failed', updateError);
    return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE });
  }
  if (!updated) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
  }

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: staff.id,
    eventType: 'menu.category.updated',
    eventData: { category_id: categoryId, changes },
  });

  invalidateConsumerPage(restaurant.slug);
  invalidateMenu(restaurant.id);

  return NextResponse.json({ ok: true, category: updated }, { status: 200, headers: NO_STORE });
}
