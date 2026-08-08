// app/api/dashboard/settings/qr/route.ts
//
// POST /api/dashboard/settings/qr
// Body: QrSettingsPayload (see lib/dashboard/settings/qrSettingsValidation.ts)
//
// Writes `qr_item_notes_enabled` only — NEVER `qr_item_notes_allowed`. That
// column is dropped by D5.5's migration; even before the migration lands,
// this route must not write it (would resurrect the dead-column split this
// unit exists to close).

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { invalidateConsumerPage } from '@/lib/consumer/cache';
import { resolveMenuMutationContext } from '@/lib/dashboard/menu/resolveMenuMutationContext';
import {
  parseQrSettingsPayload,
  validateQrSettingsPayload,
  type QrSettingsPayload,
} from '@/lib/dashboard/settings/qrSettingsValidation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

const WRITE_COLUMNS = [
  'qr_auto_accept',
  'qr_item_notes_enabled',
  'qr_menu_language',
  'qr_widget_accent_color',
  'qr_pay_now_enabled',
  'qr_pay_at_table_enabled',
] as const satisfies readonly (keyof QrSettingsPayload)[];

type CurrentRow = Record<(typeof WRITE_COLUMNS)[number], unknown> & {
  service_qr_enabled: boolean;
};

export async function POST(req: NextRequest) {
  const resolved = await resolveMenuMutationContext('settings.qr.edit');
  if (!resolved.ok) return resolved.response;
  const { restaurant, staff } = resolved.ctx;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400, headers: NO_STORE });
  }

  const payload = parseQrSettingsPayload(rawBody);
  if (!payload) {
    return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400, headers: NO_STORE });
  }

  const admin = await createSupabaseServerClientAdmin();

  const { data: current, error: loadError } = await admin
    .from('restaurants')
    .select(
      'qr_auto_accept, qr_item_notes_enabled, qr_menu_language, qr_widget_accent_color, qr_pay_now_enabled, qr_pay_at_table_enabled, service_qr_enabled',
    )
    .eq('id', restaurant.id)
    .single<CurrentRow>();
  if (loadError || !current) {
    console.error('[settings/qr] current row load failed', loadError);
    return NextResponse.json({ ok: false, code: 'db_error' }, { status: 500, headers: NO_STORE });
  }

  const validationError = validateQrSettingsPayload(payload, {
    serviceQrEnabled: current.service_qr_enabled,
  });
  if (validationError) {
    const status = validationError.code === 'qr_not_enabled' ? 409 : 400;
    return NextResponse.json({ ok: false, ...validationError }, { status, headers: NO_STORE });
  }

  const update: Record<string, unknown> = {};
  const fieldsChanged: string[] = [];
  for (const column of WRITE_COLUMNS) {
    update[column] = payload[column];
    if ((current as Record<string, unknown>)[column] !== payload[column]) {
      fieldsChanged.push(column);
    }
  }

  const { error: updateError } = await admin.from('restaurants').update(update).eq('id', restaurant.id);
  if (updateError) {
    console.error('[settings/qr] update failed', updateError);
    return NextResponse.json({ ok: false, code: 'db_error' }, { status: 500, headers: NO_STORE });
  }

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: staff.id,
    eventType: 'settings.qr.edit',
    eventData: { fields_changed: fieldsChanged },
  });

  invalidateConsumerPage(restaurant.slug);

  return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
}
