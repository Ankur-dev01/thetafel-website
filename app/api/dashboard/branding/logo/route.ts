// app/api/dashboard/branding/logo/route.ts
//
// POST   /api/dashboard/branding/logo    multipart/form-data, field "file"
// DELETE /api/dashboard/branding/logo
//
// Mirrors app/api/v1/restaurants/photo/route.ts's upload shape (server-side
// upload with the service-role client, since storage.objects RLS has no
// policy for restaurant-assets writes — same "sensitive operations
// server-side" pattern). Writes the dormant brand_logo_url column, which
// QrHeader.tsx already reads directly.

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { invalidateConsumerPage } from '@/lib/consumer/cache';
import { resolveMenuMutationContext } from '@/lib/dashboard/menu/resolveMenuMutationContext';
import { uploadBrandingAsset, removeBrandingAsset } from '@/lib/dashboard/branding/assetUpload';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

export async function POST(req: NextRequest) {
  const resolved = await resolveMenuMutationContext('settings.branding.edit');
  if (!resolved.ok) return resolved.response;
  const { restaurant, staff } = resolved.ctx;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ ok: false, code: 'no_file' }, { status: 400, headers: NO_STORE });
  }

  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ ok: false, code: 'no_file' }, { status: 400, headers: NO_STORE });
  }

  const uploaded = await uploadBrandingAsset(restaurant.id, 'logo', file);
  if (!uploaded.ok) {
    const status = uploaded.error === 'upload_failed' ? 500 : 400;
    return NextResponse.json({ ok: false, code: uploaded.error }, { status, headers: NO_STORE });
  }

  const admin = await createSupabaseServerClientAdmin();
  const { error: updateError } = await admin
    .from('restaurants')
    .update({ brand_logo_url: uploaded.url })
    .eq('id', restaurant.id);
  if (updateError) {
    console.error('[dashboard/branding/logo] db update failed', updateError);
    return NextResponse.json({ ok: false, code: 'db_error' }, { status: 500, headers: NO_STORE });
  }

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: staff.id,
    eventType: 'restaurant.branding_logo_updated',
    eventData: { file_size_bytes: file.size, mime: file.type },
  });

  invalidateConsumerPage(restaurant.slug);

  return NextResponse.json({ ok: true, logoUrl: uploaded.url }, { status: 200, headers: NO_STORE });
}

export async function DELETE() {
  const resolved = await resolveMenuMutationContext('settings.branding.edit');
  if (!resolved.ok) return resolved.response;
  const { restaurant, staff } = resolved.ctx;

  await removeBrandingAsset(restaurant.id, 'logo');

  const admin = await createSupabaseServerClientAdmin();
  const { error: updateError } = await admin
    .from('restaurants')
    .update({ brand_logo_url: null })
    .eq('id', restaurant.id);
  if (updateError) {
    console.error('[dashboard/branding/logo] db clear failed', updateError);
    return NextResponse.json({ ok: false, code: 'db_error' }, { status: 500, headers: NO_STORE });
  }

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: staff.id,
    eventType: 'restaurant.branding_logo_removed',
    eventData: {},
  });

  invalidateConsumerPage(restaurant.slug);

  return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
}
