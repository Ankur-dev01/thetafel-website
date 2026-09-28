// app/api/dashboard/branding/route.ts
//
// POST /api/dashboard/branding
// Body: BrandingColorPayload (see lib/dashboard/settings/brandingValidation.ts)
//
// Writes BOTH brand_primary_hex and qr_widget_accent_color from a single
// payload. resolveBrandTokens prefers brand_primary_hex, but the QR
// settings page's own "Accentkleur" field reads qr_widget_accent_color —
// writing only one column would leave the other page showing a stale
// value. D5.7.1 (separate follow-up) consolidates QR settings onto
// brand_primary_hex and drops this double-write.

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { invalidateConsumerPage } from '@/lib/consumer/cache';
import { resolveMenuMutationContext } from '@/lib/dashboard/menu/resolveMenuMutationContext';
import {
  parseBrandingColorPayload,
  validateBrandingColorPayload,
} from '@/lib/dashboard/settings/brandingValidation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

const WRITE_COLUMNS = ['brand_primary_hex', 'qr_widget_accent_color'] as const;

type CurrentRow = Record<(typeof WRITE_COLUMNS)[number], unknown>;

export async function POST(req: NextRequest) {
  const resolved = await resolveMenuMutationContext('settings.branding.edit');
  if (!resolved.ok) return resolved.response;
  const { restaurant, staff } = resolved.ctx;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400, headers: NO_STORE });
  }

  const payload = parseBrandingColorPayload(rawBody);
  if (!payload) {
    return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400, headers: NO_STORE });
  }

  const validationError = validateBrandingColorPayload(payload);
  if (validationError) {
    return NextResponse.json({ ok: false, ...validationError }, { status: 400, headers: NO_STORE });
  }

  const admin = await createSupabaseServerClientAdmin();

  const { data: current, error: loadError } = await admin
    .from('restaurants')
    .select('brand_primary_hex, qr_widget_accent_color')
    .eq('id', restaurant.id)
    .single<CurrentRow>();
  if (loadError || !current) {
    console.error('[dashboard/branding] current row load failed', loadError);
    return NextResponse.json({ ok: false, code: 'db_error' }, { status: 500, headers: NO_STORE });
  }

  const update: Record<string, unknown> = {
    brand_primary_hex: payload.primary_hex,
    qr_widget_accent_color: payload.primary_hex,
  };
  const fieldsChanged = WRITE_COLUMNS.filter(
    (column) => (current as Record<string, unknown>)[column] !== update[column]
  );

  const { error: updateError } = await admin.from('restaurants').update(update).eq('id', restaurant.id);
  if (updateError) {
    console.error('[dashboard/branding] update failed', updateError);
    return NextResponse.json({ ok: false, code: 'db_error' }, { status: 500, headers: NO_STORE });
  }

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: staff.id,
    eventType: 'restaurant.branding_color_updated',
    eventData: { primary_hex: payload.primary_hex, fields_changed: fieldsChanged },
  });

  invalidateConsumerPage(restaurant.slug);

  return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
}
