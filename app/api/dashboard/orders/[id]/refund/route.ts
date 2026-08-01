// app/api/dashboard/orders/[id]/refund/route.ts
//
// POST /api/dashboard/orders/{id}/refund
// Body: { reason?: string }
//
// Marks a completed, paid order as refunded. Only legal from
// status='completed' AND payment_status='paid' — full-order refund only, no
// partial-refund UI in this unit.
//
// No Mollie call. `payment_status` is deliberately left untouched — D6.4
// flips it once the real Mollie refund confirms; `orders.status='refunded'`
// here is just the dashboard's own marker, and the audit row carries what
// D6.4 needs to reconcile.

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient, createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { assertDashboardWriteAllowed } from '@/lib/dashboard/guards/assertDashboardWriteAllowed';
import { dashboardMutationRateLimit } from '@/lib/dashboard/rateLimit';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { invalidateConsumerPage } from '@/lib/consumer/cache';
import { transitionOrderStatus } from '@/lib/orders/transitionOrderStatus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_REASON_LENGTH = 500;

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

  const guard = await assertDashboardWriteAllowed(restaurant.id, 'order.refund');
  if (!guard.ok) {
    return NextResponse.json({ error: guard.reason }, { status: guard.httpStatus, headers: { 'Cache-Control': 'no-store' } });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    rawBody = {};
  }
  const rawReason = (rawBody as { reason?: unknown })?.reason;
  if (rawReason !== undefined && (typeof rawReason !== 'string' || rawReason.length > MAX_REASON_LENGTH)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  const reason = typeof rawReason === 'string' ? rawReason.trim() || null : null;

  const { data: order } = await supabase
    .from('orders')
    .select('id, status, order_type, payment_status, total_cents, restaurant_id')
    .eq('id', orderId)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle();
  if (!order) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  if (order.status === 'cancelled' || order.status === 'refunded') {
    return NextResponse.json({ error: 'already_terminal' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
  }
  if (order.status !== 'completed') {
    return NextResponse.json({ error: 'not_completed' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
  }
  if (order.payment_status !== 'paid') {
    return NextResponse.json({ error: 'not_paid' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
  }

  const admin = await createSupabaseServerClientAdmin();
  const result = await transitionOrderStatus(admin, {
    orderId: order.id,
    restaurantId: restaurant.id,
    from: 'completed',
    to: 'refunded',
  });

  if (!result.ok) {
    if (result.reason === 'stale_state') {
      return NextResponse.json({ error: 'already_advanced' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
    }
    console.error('[orders/refund] transition failed', result);
    return NextResponse.json({ error: 'db_error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: guard.staff.id,
    eventType: 'order.refunded',
    eventData: {
      reason,
      refund_amount_cents: order.total_cents,
      payment_status_before: order.payment_status,
    },
    orderId: order.id,
  });

  invalidateConsumerPage(restaurant.slug);

  return NextResponse.json(
    { ok: true, order: { id: result.row.id, status: result.row.status } },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
