// app/api/dashboard/notifications/route.ts
//
// POST /api/dashboard/notifications
// Body: NotificationsPayload (see lib/dashboard/settings/notificationsValidation.ts)
//
// Owner-only via resolveMenuMutationContext('settings.notifications.edit')
// — that action key already existed in lib/dashboard/permissions.ts's
// DashboardAction union before this unit; the can() stub gates every
// action to owner-only regardless, so no permissions.ts change needed.
//
// D5.6a: per-restaurant on/off toggles for the four guest-facing
// notification events already wired (booking confirmed/cancelled,
// takeaway order confirmed/ready). Unlike settings/business, there's no
// uniqueness check and no invalidateConsumerPage call — these columns
// are read only by server-side dispatchers, never rendered on any
// consumer-facing page, so there's nothing in the consumer cache to bust.

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { resolveMenuMutationContext } from '@/lib/dashboard/menu/resolveMenuMutationContext';
import {
  parseNotificationsPayload,
  type NotificationsPayload,
} from '@/lib/dashboard/settings/notificationsValidation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' } as const;

const WRITE_COLUMNS = [
  'notify_booking_confirmed',
  'notify_booking_cancelled',
  'notify_order_confirmed',
  'notify_order_ready',
] as const satisfies readonly (keyof NotificationsPayload)[];

type CurrentRow = Record<(typeof WRITE_COLUMNS)[number], unknown>;

export async function POST(req: NextRequest) {
  const resolved = await resolveMenuMutationContext('settings.notifications.edit');
  if (!resolved.ok) return resolved.response;
  const { restaurant, staff } = resolved.ctx;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400, headers: NO_STORE });
  }

  const payload = parseNotificationsPayload(rawBody);
  if (!payload) {
    return NextResponse.json({ ok: false, code: 'invalid_body' }, { status: 400, headers: NO_STORE });
  }

  const admin = await createSupabaseServerClientAdmin();

  const { data: current, error: loadError } = await admin
    .from('restaurants')
    .select('notify_booking_confirmed, notify_booking_cancelled, notify_order_confirmed, notify_order_ready')
    .eq('id', restaurant.id)
    .single<CurrentRow>();
  if (loadError || !current) {
    console.error('[dashboard/notifications] current row load failed', loadError);
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
    console.error('[dashboard/notifications] update failed', updateError);
    return NextResponse.json({ ok: false, code: 'db_error' }, { status: 500, headers: NO_STORE });
  }

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: staff.id,
    eventType: 'restaurant.notifications_updated',
    eventData: { fields_changed: fieldsChanged },
  });

  return NextResponse.json({ ok: true }, { status: 200, headers: NO_STORE });
}
