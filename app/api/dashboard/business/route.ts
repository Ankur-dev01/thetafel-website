// app/api/dashboard/business/route.ts
//
// POST /api/dashboard/business
// Body: BusinessPayload (see lib/dashboard/settings/businessValidation.ts)
//
// Owner-only (see lib/dashboard/permissions.ts's stub `can()` — every
// action is owner-only until D8.2 ships the real per-role matrix, so
// gating on 'settings.business.edit' via resolveMenuMutationContext is
// already sufficient; no extra role check needed here).
//
// BTW-2: the backfill mechanism for the 5 pre-BTW-1 live restaurants
// whose btw_number is NULL, plus the first dashboard surface for the
// commercial-identity fields (display_name, trade_name, contact_phone,
// contact_email, website, cuisine_type) that were only ever set once,
// during onboarding, and never resurfaced.

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { invalidateConsumerPage } from '@/lib/consumer/cache';
import { resolveMenuMutationContext } from '@/lib/dashboard/menu/resolveMenuMutationContext';
import {
  parseBusinessPayload,
  validateBusinessPayload,
  type BusinessPayload,
} from '@/lib/dashboard/settings/businessValidation';
import { isUniqueViolationOnColumn } from '@/lib/db/postgresErrors';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

const WRITE_COLUMNS = [
  'display_name',
  'trade_name',
  'btw_number',
  'contact_phone',
  'contact_email',
  'website',
  'cuisine_type',
] as const satisfies readonly (keyof BusinessPayload)[];

type CurrentRow = Record<(typeof WRITE_COLUMNS)[number], unknown>;

export async function POST(req: NextRequest) {
  const resolved = await resolveMenuMutationContext('settings.business.edit');
  if (!resolved.ok) return resolved.response;
  const { restaurant, staff } = resolved.ctx;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400, headers: NO_STORE });
  }

  const payload = parseBusinessPayload(rawBody);
  if (!payload) {
    return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400, headers: NO_STORE });
  }

  const validationError = validateBusinessPayload(payload);
  if (validationError) {
    return NextResponse.json({ ok: false, ...validationError }, { status: 400, headers: NO_STORE });
  }

  const admin = await createSupabaseServerClientAdmin();

  const { data: current, error: loadError } = await admin
    .from('restaurants')
    .select('display_name, trade_name, btw_number, contact_phone, contact_email, website, cuisine_type')
    .eq('id', restaurant.id)
    .single<CurrentRow>();
  if (loadError || !current) {
    console.error('[dashboard/business] current row load failed', loadError);
    return NextResponse.json({ ok: false, code: 'db_error' }, { status: 500, headers: NO_STORE });
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
    if (isUniqueViolationOnColumn(updateError, 'btw_number')) {
      return NextResponse.json(
        { ok: false, code: 'btw_already_linked', message: 'This BTW number is already linked to another restaurant.' },
        { status: 409, headers: NO_STORE },
      );
    }
    console.error('[dashboard/business] update failed', updateError);
    return NextResponse.json({ ok: false, code: 'db_error' }, { status: 500, headers: NO_STORE });
  }

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: staff.id,
    eventType: 'settings.business.edit',
    eventData: { fields_changed: fieldsChanged },
  });

  invalidateConsumerPage(restaurant.slug);

  return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
}
