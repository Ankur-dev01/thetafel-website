// app/api/dashboard/menu/items/[id]/update/route.ts
//
// POST /api/dashboard/menu/items/{id}/update
// Body: ItemPatch
//
// Full overwrite of the editable fields. Re-parenting is supported: when
// category_id changes the item appends to the end of the new category and
// the old category is renumbered dense, so neither side is left with a gap.

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { invalidateConsumerPage, invalidateMenu } from '@/lib/consumer/cache';
import { resolveMenuMutationContext } from '@/lib/dashboard/menu/resolveMenuMutationContext';
import { renumberCategoryItems } from '@/lib/dashboard/menu/renumberItems';
import {
  parseItemPatchBody,
  normalizeItemPatch,
  validateItemPatch,
  type ItemPatch,
} from '@/lib/dashboard/menu/itemValidation';
import { normalizeDietaryTags } from '@/lib/dashboard/menu/normalizeTags';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

const DIFFED_FIELDS: (keyof ItemPatch)[] = [
  'category_id',
  'name_nl',
  'name_en',
  'description_nl',
  'description_en',
  'price_cents',
  'vat_rate_bp',
  'dietary_tags',
  'visible_takeaway',
  'visible_qr',
  'available',
];

function sameValue(before: unknown, after: unknown): boolean {
  if (Array.isArray(before) && Array.isArray(after)) {
    return before.length === after.length && before.every((v, i) => v === after[i]);
  }
  return before === after;
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: itemId } = await ctx.params;

  const resolved = await resolveMenuMutationContext('menu.item.edit');
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

  const { data: current } = await supabase
    .from('menu_items')
    .select(
      'id, category_id, name_nl, name_en, description_nl, description_en, price_cents, vat_rate_bp, dietary_tags, visible_takeaway, visible_qr, available, display_order',
    )
    .eq('id', itemId)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle();
  if (!current) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
  }

  const oldCategoryId = current.category_id as string | null;
  const reparenting = oldCategoryId !== patch.category_id;

  if (reparenting) {
    const { data: category } = await supabase
      .from('menu_categories')
      .select('id')
      .eq('id', patch.category_id)
      .eq('restaurant_id', restaurant.id)
      .maybeSingle();
    if (!category) {
      return NextResponse.json({ error: 'unknown_category' }, { status: 400, headers: NO_STORE });
    }
  }

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const field of DIFFED_FIELDS) {
    const before = (current as Record<string, unknown>)[field];
    const after = patch[field];
    if (!sameValue(before, after)) changes[field] = { from: before, to: after };
  }

  const admin = await createSupabaseServerClientAdmin();

  // Re-parenting moves the item to the end of its new category; staying put
  // keeps its current position untouched (ordering is the reorder route's job).
  let nextDisplayOrder = current.display_order as number | null;
  if (reparenting) {
    const { data: last } = await supabase
      .from('menu_items')
      .select('display_order')
      .eq('restaurant_id', restaurant.id)
      .eq('category_id', patch.category_id)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    nextDisplayOrder = last ? (last.display_order ?? -1) + 1 : 0;
  }

  const { data: updated, error: updateError } = await admin
    .from('menu_items')
    .update({
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
    .eq('id', itemId)
    .eq('restaurant_id', restaurant.id)
    .select('id, category_id, name_nl, display_order')
    .maybeSingle();

  if (updateError) {
    console.error('[menu/items/update] update failed', updateError);
    return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE });
  }
  if (!updated) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
  }

  if (reparenting && oldCategoryId) {
    await renumberCategoryItems(admin, restaurant.id, oldCategoryId);
  }

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: staff.id,
    eventType: 'menu.item.updated',
    eventData: { item_id: itemId, changes },
  });

  invalidateConsumerPage(restaurant.slug);
  invalidateMenu(restaurant.id);

  return NextResponse.json({ ok: true, item: updated }, { status: 200, headers: NO_STORE });
}
