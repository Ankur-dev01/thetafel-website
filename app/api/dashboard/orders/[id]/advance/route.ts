// app/api/dashboard/orders/[id]/advance/route.ts
//
// POST /api/dashboard/orders/{id}/advance
// Body: { to: OrderStatus }
//
// Advances an order one legal step along its lifecycle. Cancel/refund are
// NOT progression — those live in D3.3's own endpoint; this route rejects
// them with `use_cancel_endpoint`. The state machine is server-computed and
// order-type-aware (ready branches to 'completed' for takeaway vs 'served'
// for qr) — the client sends `to`, never trusted as legal on its own.
//
// `ready_notified_at` is deliberately NOT set here. It's owned exclusively by
// dispatchTakeawayReady.ts as an idempotent "did the ready notification
// actually fire" guard (see that file's own comment) — setting it in this
// route's UPDATE would trip that guard before the fire-and-forget email call
// even runs, permanently skipping every takeaway ready email. QR orders
// never get a ready notification, so their ready_notified_at stays null
// forever; the D1.2 alert strip already falls back to `updated_at` for that
// case (lib/dashboard/queries/alerts.ts).

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient, createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { assertDashboardWriteAllowed } from '@/lib/dashboard/guards/assertDashboardWriteAllowed';
import { dashboardMutationRateLimit } from '@/lib/dashboard/rateLimit';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { invalidateConsumerPage } from '@/lib/consumer/cache';
import { transitionOrderStatus, type OrderStatus } from '@/lib/orders/transitionOrderStatus';
import { sendTakeawayReadyEmail } from '@/lib/consumer/notifications/dispatchTakeawayReady';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALL_STATUSES: OrderStatus[] = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'served',
  'completed',
  'cancelled',
  'refunded',
];

/**
 * The advance-endpoint's own state machine — a stricter, order-type-aware
 * subset of the general order_status graph (lib/orders/transitionOrderStatus.ts's
 * `canTransitionOrderStatus`, which also allows cancel from any active state).
 * No skipping (kitchen must accept before starting), no going back, and
 * cancel/refund are out of scope here entirely.
 */
function legalNextStatuses(from: OrderStatus, orderType: 'qr' | 'takeaway'): OrderStatus[] {
  switch (from) {
    case 'pending':
      return ['confirmed'];
    case 'confirmed':
      return ['preparing'];
    case 'preparing':
      return ['ready'];
    case 'ready':
      return orderType === 'takeaway' ? ['completed'] : ['served'];
    default:
      return [];
  }
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: orderId } = await ctx.params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'not_authenticated' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  const rl = await dashboardMutationRateLimit(user.id);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'rate_limited' },
      { status: 429, headers: { 'Retry-After': String(rl.retryAfter ?? 60), 'Cache-Control': 'no-store' } },
    );
  }

  const { data: restaurant, error: restaurantError } = await supabase
    .from('restaurants')
    .select('id, slug')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (restaurantError || !restaurant) {
    return NextResponse.json({ error: 'restaurant_not_found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  const guard = await assertDashboardWriteAllowed(restaurant.id, 'order.status.advance');
  if (!guard.ok) {
    return NextResponse.json({ error: guard.reason }, { status: guard.httpStatus, headers: { 'Cache-Control': 'no-store' } });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const to = (rawBody as { to?: unknown })?.to;
  if (typeof to !== 'string' || !ALL_STATUSES.includes(to as OrderStatus)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  if (to === 'cancelled' || to === 'refunded') {
    return NextResponse.json({ error: 'use_cancel_endpoint' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  const targetStatus = to as OrderStatus;

  const { data: order } = await supabase
    .from('orders')
    .select('id, status, order_type, guest_id, table_id, restaurant_id')
    .eq('id', orderId)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  const fromStatus = order.status as OrderStatus;
  if (!legalNextStatuses(fromStatus, order.order_type).includes(targetStatus)) {
    return NextResponse.json({ error: 'illegal_transition' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
  }

  const admin = await createSupabaseServerClientAdmin();
  const result = await transitionOrderStatus(admin, {
    orderId: order.id,
    restaurantId: restaurant.id,
    from: fromStatus,
    to: targetStatus,
  });

  if (!result.ok) {
    if (result.reason === 'stale_state') {
      return NextResponse.json({ error: 'already_advanced' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
    }
    console.error('[orders/advance] transition failed', result);
    return NextResponse.json({ error: 'db_error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: guard.staff.id,
    eventType: `order.${targetStatus}`,
    eventData: { from: fromStatus, to: targetStatus, order_type: order.order_type },
    orderId: order.id,
  });

  invalidateConsumerPage(restaurant.slug);

  if (targetStatus === 'ready' && order.order_type === 'takeaway') {
    // Fire-and-forget: never blocks the response, never fails the route.
    // No `guests.locale` column exists yet — Dutch default (see D3.2 report).
    sendTakeawayReadyEmail(order.id, 'nl').catch((err) => {
      console.error('[orders/advance] ready email failed', err);
    });
  }

  return NextResponse.json(
    { ok: true, order: { id: result.row.id, status: result.row.status, ready_notified_at: result.row.ready_notified_at } },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
