// app/api/dashboard/menu/items/[id]/variants/[variantId]/update/route.ts
//
// POST /api/dashboard/menu/items/{id}/variants/{variantId}/update
// Body: VariantPatch

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

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string; variantId: string }> }) {
  const { id: itemId, variantId } = await ctx.params;

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

  const { data: item } = await supabase
    .from('menu_items')
    .select('id')
    .eq('id', itemId)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle();
  if (!item) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
  }

  const { data: current } = await supabase
    .from('menu_item_variants')
    .select('id, name_nl, price_delta_cents')
    .eq('id', variantId)
    .eq('item_id', itemId)
    .maybeSingle();
  if (!current) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
  }

  const changes: Record<string, { from: unknown; to: unknown }> = {};
  if (current.name_nl !== patch.name_nl) changes.name_nl = { from: current.name_nl, to: patch.name_nl };
  if (current.price_delta_cents !== patch.price_delta_cents) {
    changes.price_delta_cents = { from: current.price_delta_cents, to: patch.price_delta_cents };
  }

  const admin = await createSupabaseServerClientAdmin();
  const { data: updated, error: updateError } = await admin
    .from('menu_item_variants')
    .update({ name_nl: patch.name_nl, price_delta_cents: patch.price_delta_cents })
    .eq('id', variantId)
    .eq('item_id', itemId)
    .select('id, name_nl, price_delta_cents')
    .maybeSingle();

  if (updateError) {
    console.error('[menu/variants/update] update failed', updateError);
    return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE });
  }
  if (!updated) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
  }

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: staff.id,
    eventType: 'menu.variant.updated',
    eventData: { item_id: itemId, variant_id: variantId, changes },
  });

  invalidateConsumerPage(restaurant.slug);
  invalidateMenu(restaurant.id);

  return NextResponse.json({ ok: true, variant: updated }, { status: 200, headers: NO_STORE });
}
