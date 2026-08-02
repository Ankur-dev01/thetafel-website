// app/api/dashboard/menu/items/[id]/variants/create/route.ts
//
// POST /api/dashboard/menu/items/{id}/variants/create
// Body: VariantPatch
//
// Guarded by `menu.item.edit`, not a variant-specific key: a variant has no
// independent meaning, and extra granularity buys nothing while can() is
// still the D0.4 owner-passthrough stub.
//
// menu_item_variants has no display_order column, so ordering is by
// created_at — insertion order, and there is no way to reorder in D4.3.

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { invalidateConsumerPage, invalidateMenu } from '@/lib/consumer/cache';
import { resolveMenuMutationContext } from '@/lib/dashboard/menu/resolveMenuMutationContext';
import {
  parseVariantPatchBody,
  normalizeVariantPatch,
  validateVariantPatch,
} from '@/lib/dashboard/menu/variantValidation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

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

  const parsed = parseVariantPatchBody(rawBody);
  if (!parsed) return NextResponse.json({ error: 'invalid_body' }, { status: 400, headers: NO_STORE });

  const patch = normalizeVariantPatch(parsed);
  const errors = validateVariantPatch(patch);
  if (errors.length > 0) {
    return NextResponse.json({ error: 'invalid_body', errors }, { status: 400, headers: NO_STORE });
  }

  // Scope check on the parent: menu_item_variants has no restaurant_id of
  // its own, so the only cross-restaurant guard is the item lookup.
  const { data: item } = await supabase
    .from('menu_items')
    .select('id')
    .eq('id', itemId)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle();
  if (!item) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
  }

  const admin = await createSupabaseServerClientAdmin();
  const { data: inserted, error: insertError } = await admin
    .from('menu_item_variants')
    .insert({ item_id: itemId, name_nl: patch.name_nl, price_delta_cents: patch.price_delta_cents })
    .select('id, name_nl, price_delta_cents')
    .single();

  if (insertError || !inserted) {
    console.error('[menu/variants/create] insert failed', insertError);
    return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE });
  }

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: staff.id,
    eventType: 'menu.variant.created',
    eventData: {
      item_id: itemId,
      variant_id: inserted.id,
      name_nl: inserted.name_nl,
      price_delta_cents: inserted.price_delta_cents,
    },
  });

  invalidateConsumerPage(restaurant.slug);
  invalidateMenu(restaurant.id);

  return NextResponse.json({ ok: true, variant: inserted }, { status: 200, headers: NO_STORE });
}
