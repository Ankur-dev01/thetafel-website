// app/api/dashboard/menu/items/[id]/photo/delete/route.ts
//
// POST /api/dashboard/menu/items/{id}/photo/delete
// Body: {} — nothing to send.
//
// Clears the row's photo columns first, then removes the objects only if no
// other item still references them. An item with no photo is a successful
// no-op rather than an error: the caller's desired end state already holds.

import { NextResponse } from 'next/server';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { invalidateConsumerPage, invalidateMenu } from '@/lib/consumer/cache';
import { resolveMenuMutationContext } from '@/lib/dashboard/menu/resolveMenuMutationContext';
import { safeCleanupPhoto } from '@/lib/dashboard/menu/photoReferenceCount';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id: itemId } = await ctx.params;

  const resolved = await resolveMenuMutationContext('menu.item.photo.edit');
  if (!resolved.ok) return resolved.response;
  const { supabase, restaurant, staff } = resolved.ctx;

  const { data: item } = await supabase
    .from('menu_items')
    .select('id, photo_path, photo_thumb_path')
    .eq('id', itemId)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle();
  if (!item) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
  }

  if (!item.photo_path && !item.photo_thumb_path) {
    return NextResponse.json({ ok: true, noop: true }, { status: 200, headers: NO_STORE });
  }

  const admin = await createSupabaseServerClientAdmin();
  const { error: updateError } = await admin
    .from('menu_items')
    .update({ photo_path: null, photo_thumb_path: null })
    .eq('id', itemId)
    .eq('restaurant_id', restaurant.id);
  if (updateError) {
    console.error('[menu/photo/delete] db update failed', updateError);
    return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE });
  }

  const cleanup = await safeCleanupPhoto(restaurant.id, itemId, item.photo_path, item.photo_thumb_path);

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: staff.id,
    eventType: 'menu.item.photo_deleted',
    eventData: {
      item_id: itemId,
      deleted_photo_path: item.photo_path,
      deleted_thumb_path: item.photo_thumb_path,
      cleaned_up: cleanup.deleted,
      kept_shared: cleanup.kept,
    },
  });

  invalidateConsumerPage(restaurant.slug);
  invalidateMenu(restaurant.id);

  return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
}
