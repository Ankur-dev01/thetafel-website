// app/api/dashboard/branding/hero/route.ts
//
// POST /api/dashboard/branding/hero    multipart/form-data, field "file"
//
// Same shape as the logo route, writing hero_image_url instead —
// the same column onboarding Step 3's photo route sets, using the same
// `{restaurantId}/hero.{ext}` path convention. This is the first
// post-onboarding way to change it.
//
// No DELETE — a restaurant is expected to always have a hero photo once
// onboarded (it's captured during onboarding); removing it entirely would
// leave RestaurantHeader.tsx with nothing to show. Re-upload replaces it.

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { invalidateConsumerPage } from '@/lib/consumer/cache';
import { resolveMenuMutationContext } from '@/lib/dashboard/menu/resolveMenuMutationContext';
import { uploadBrandingAsset } from '@/lib/dashboard/branding/assetUpload';

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

  const uploaded = await uploadBrandingAsset(restaurant.id, 'hero', file);
  if (!uploaded.ok) {
    const status = uploaded.error === 'upload_failed' ? 500 : 400;
    return NextResponse.json({ ok: false, code: uploaded.error }, { status, headers: NO_STORE });
  }

  const admin = await createSupabaseServerClientAdmin();
  const { error: updateError } = await admin
    .from('restaurants')
    .update({ hero_image_url: uploaded.url })
    .eq('id', restaurant.id);
  if (updateError) {
    console.error('[dashboard/branding/hero] db update failed', updateError);
    return NextResponse.json({ ok: false, code: 'db_error' }, { status: 500, headers: NO_STORE });
  }

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: staff.id,
    eventType: 'restaurant.branding_hero_updated',
    eventData: { file_size_bytes: file.size, mime: file.type },
  });

  invalidateConsumerPage(restaurant.slug);

  return NextResponse.json({ ok: true, heroUrl: uploaded.url }, { status: 200, headers: NO_STORE });
}
