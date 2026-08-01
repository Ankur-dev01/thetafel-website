// app/api/dashboard/orders/[id]/cancel/route.ts
//
// POST /api/dashboard/orders/{id}/cancel
// Body: { reason?: string }
//
// Cancels an active order (pending/confirmed/preparing/ready). `served`
// orders are rejected with `use_refund` — food is already at the table (or
// the tab is open), so cancel doesn't make sense there.
//
// No Mollie call. Money movement stays in D6.4; this route only flips
// orders.status to 'cancelled', sets cancelled_by_staff, and writes an audit
// row carrying everything D6.4 needs to find and process the refund later.
// `payment_status` is left untouched on purpose — D6.4 reconciles it once
// the actual refund (if any) lands.

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient, createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { assertDashboardWriteAllowed } from '@/lib/dashboard/guards/assertDashboardWriteAllowed';
import { dashboardMutationRateLimit } from '@/lib/dashboard/rateLimit';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { invalidateConsumerPage } from '@/lib/consumer/cache';
import { transitionOrderStatus, type OrderStatus } from '@/lib/orders/transitionOrderStatus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CANCELABLE_STATUSES: OrderStatus[] = ['pending', 'confirmed', 'preparing', 'ready'];
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

  const guard = await assertDashboardWriteAllowed(restaurant.id, 'order.cancel');
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

  const fromStatus = order.status as OrderStatus;
  if (!CANCELABLE_STATUSES.includes(fromStatus)) {
    if (fromStatus === 'served') {
      return NextResponse.json({ error: 'use_refund' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({ error: 'already_terminal' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
  }

  const paidBefore = order.payment_status === 'paid';
  const paidAmount = paidBefore ? order.total_cents : 0;

  const admin = await createSupabaseServerClientAdmin();
  const result = await transitionOrderStatus(admin, {
    orderId: order.id,
    restaurantId: restaurant.id,
    from: fromStatus,
    to: 'cancelled',
    extraSet: { cancelled_by_staff: guard.staff.id },
  });

  if (!result.ok) {
    if (result.reason === 'stale_state') {
      return NextResponse.json({ error: 'already_advanced' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
    }
    console.error('[orders/cancel] transition failed', result);
    return NextResponse.json({ error: 'db_error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: guard.staff.id,
    eventType: 'order.cancelled',
    eventData: {
      from_status: fromStatus,
      order_type: order.order_type,
      reason,
      payment_status_before: order.payment_status,
      total_cents: order.total_cents,
      paid_amount_cents: paidAmount,
      needs_refund: paidBefore,
    },
    orderId: order.id,
  });

  invalidateConsumerPage(restaurant.slug);

  return NextResponse.json(
    { ok: true, order: { id: result.row.id, status: result.row.status } },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
