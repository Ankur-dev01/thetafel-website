// app/api/dashboard/menu/items/[id]/photo/upload/route.ts
//
// POST /api/dashboard/menu/items/{id}/photo/upload
// Content-Type: multipart/form-data, single field `photo`.
//
// Order matters here: the item is loaded and confirmed to belong to this
// restaurant BEFORE anything touches storage, so a 404 can never leave an
// orphaned object behind. Storage writes happen only once the upload has been
// validated, decoded, and re-encoded.
//
// Replace semantics: a new UUID-keyed pair is written first, the row is
// pointed at it, and only then is the previous pair considered for deletion.
// If two uploads race, the later DB write wins and the earlier pair is swept
// by whichever replace runs next — the row is never left pointing at an
// object that doesn't exist.

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { invalidateConsumerPage, invalidateMenu } from '@/lib/consumer/cache';
import { resolveMenuMutationContext } from '@/lib/dashboard/menu/resolveMenuMutationContext';
import { validatePhoto, MAX_SIZE_BYTES } from '@/lib/dashboard/menu/photoValidation';
import { processPhoto } from '@/lib/dashboard/menu/photoProcessing';
import { generatePhotoKeys, uploadPhotoPair, deletePhotoObjects } from '@/lib/dashboard/menu/photoStorage';
import { safeCleanupPhoto } from '@/lib/dashboard/menu/photoReferenceCount';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: itemId } = await ctx.params;

  const resolved = await resolveMenuMutationContext('menu.item.photo.edit');
  if (!resolved.ok) return resolved.response;
  const { supabase, restaurant, staff } = resolved.ctx;

  // Existence + ownership first — nothing is written to storage until this passes.
  const { data: item } = await supabase
    .from('menu_items')
    .select('id, name_nl, photo_path, photo_thumb_path')
    .eq('id', itemId)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle();
  if (!item) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'no_file' }, { status: 400, headers: NO_STORE });
  }

  const file = formData.get('photo');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'no_file' }, { status: 400, headers: NO_STORE });
  }
  // Cheap pre-check before buffering the whole body into memory.
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'too_large' }, { status: 400, headers: NO_STORE });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const validation = await validatePhoto(buffer, file.type);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.code }, { status: 400, headers: NO_STORE });
  }

  let processed;
  try {
    processed = await processPhoto(buffer);
  } catch (err) {
    console.error('[menu/photo/upload] sharp processing failed', err);
    return NextResponse.json({ error: 'processing_failed' }, { status: 400, headers: NO_STORE });
  }

  const keys = generatePhotoKeys(restaurant.id, itemId);
  try {
    await uploadPhotoPair(keys, processed.full, processed.thumb);
  } catch (err) {
    console.error('[menu/photo/upload] storage upload failed', err);
    return NextResponse.json({ error: 'upload_failed' }, { status: 500, headers: NO_STORE });
  }

  const admin = await createSupabaseServerClientAdmin();
  const { data: updated, error: updateError } = await admin
    .from('menu_items')
    .update({ photo_path: keys.fullKey, photo_thumb_path: keys.thumbKey })
    .eq('id', itemId)
    .eq('restaurant_id', restaurant.id)
    .select('id, photo_path, photo_thumb_path')
    .maybeSingle();

  if (updateError || !updated) {
    // The row vanished (or the write failed) after we uploaded — drop the new
    // objects rather than leaving them unreferenced.
    await deletePhotoObjects([keys.fullKey, keys.thumbKey]);
    if (updateError) {
      console.error('[menu/photo/upload] db update failed', updateError);
      return NextResponse.json({ error: 'db_error' }, { status: 500, headers: NO_STORE });
    }
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: NO_STORE });
  }

  // Best-effort: the row is already authoritative, so a cleanup failure must
  // not fail the request.
  const cleanup = await safeCleanupPhoto(restaurant.id, itemId, item.photo_path, item.photo_thumb_path);

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: staff.id,
    eventType: 'menu.item.photo_uploaded',
    eventData: {
      item_id: itemId,
      new_photo_path: keys.fullKey,
      new_thumb_path: keys.thumbKey,
      old_photo_path: item.photo_path,
      old_thumb_path: item.photo_thumb_path,
      // Filename is deliberately not logged — it is owner-supplied free text
      // that can carry personal information.
      file_size_bytes: file.size,
      actual_mime: validation.actualMime,
      width: validation.width,
      height: validation.height,
      cleaned_up: cleanup.deleted,
      kept_shared: cleanup.kept,
    },
  });

  invalidateConsumerPage(restaurant.slug);
  invalidateMenu(restaurant.id);

  return NextResponse.json(
    { ok: true, photo_path: keys.fullKey, photo_thumb_path: keys.thumbKey },
    { status: 200, headers: NO_STORE },
  );
}
