// app/api/dashboard/tabs/[id]/close/route.ts
//
// POST /api/dashboard/tabs/{id}/close
// Body: { settlement: 'paid_at_table' | 'written_off', reason?: string }
//
// Closes an open tab. `tabs.status` in the live schema is
// open | settled | cancelled — there is no 'closed' value, so the two
// settlement paths map onto the two terminal statuses:
//   paid_at_table -> status='settled' (+ settled_at, required by the
//                    tabs_settled_consistent CHECK) + settlement='paid_at_table'
//   written_off   -> status='cancelled' + settlement='written_off' + write_off_reason
//
// Paid-at-table cascades every non-terminal order on the tab to 'completed'
// (guest paid for what was on the tab). Write-off leaves order statuses and
// payment_status untouched — no money moved, nothing to reconcile yet.
//
// No Mollie call, no payment_status writes on either path — D6 owns money
// reconciliation. This route is the operational close only.

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient, createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { assertDashboardWriteAllowed } from '@/lib/dashboard/guards/assertDashboardWriteAllowed';
import { dashboardMutationRateLimit } from '@/lib/dashboard/rateLimit';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { invalidateConsumerPage } from '@/lib/consumer/cache';
import { transitionOrderStatus, type OrderStatus } from '@/lib/orders/transitionOrderStatus';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_REASON_LENGTH = 500;
const CASCADE_FROM_STATUSES: OrderStatus[] = ['served', 'ready', 'preparing', 'confirmed', 'pending'];

type Settlement = 'paid_at_table' | 'written_off';

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: tabId } = await ctx.params;

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

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    rawBody = {};
  }
  const rawSettlement = (rawBody as { settlement?: unknown })?.settlement;
  if (rawSettlement !== 'paid_at_table' && rawSettlement !== 'written_off') {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  const settlement = rawSettlement as Settlement;

  const rawReason = (rawBody as { reason?: unknown })?.reason;
  if (rawReason !== undefined && (typeof rawReason !== 'string' || rawReason.length > MAX_REASON_LENGTH)) {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }
  const reason = typeof rawReason === 'string' ? rawReason.trim() || null : null;
  if (settlement === 'written_off' && !reason) {
    return NextResponse.json({ error: 'reason_required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  }

  const guard = await assertDashboardWriteAllowed(restaurant.id, settlement === 'paid_at_table' ? 'tab.close' : 'tab.write_off');
  if (!guard.ok) {
    return NextResponse.json({ error: guard.reason }, { status: guard.httpStatus, headers: { 'Cache-Control': 'no-store' } });
  }

  const { data: tab } = await supabase
    .from('tabs')
    .select('id, status, total_cents, restaurant_id, table_id, opened_at')
    .eq('id', tabId)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle();
  if (!tab) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }
  if (tab.status !== 'open') {
    return NextResponse.json({ error: 'already_closed' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
  }

  const admin = await createSupabaseServerClientAdmin();
  const closedAtIso = new Date().toISOString();

  const tabExtraSet: Record<string, unknown> = {
    status: settlement === 'paid_at_table' ? 'settled' : 'cancelled',
    settlement,
    closed_at: closedAtIso,
    closed_by: guard.staff.id,
    write_off_reason: settlement === 'written_off' ? reason : null,
  };
  if (settlement === 'paid_at_table') {
    tabExtraSet.settled_at = closedAtIso;
  }

  const { data: closedTab, error: closeError } = await admin
    .from('tabs')
    .update(tabExtraSet)
    .eq('id', tabId)
    .eq('restaurant_id', restaurant.id)
    .eq('status', 'open')
    .select('id, status, settlement')
    .maybeSingle();

  if (closeError) {
    console.error('[tabs/close] tab update failed', closeError);
    return NextResponse.json({ error: 'db_error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!closedTab) {
    return NextResponse.json({ error: 'already_closed' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
  }

  let cascadeOrderIds: string[] = [];
  const cascadeSkipped: string[] = [];

  if (settlement === 'paid_at_table') {
    const { data: cascadeOrders, error: ordersError } = await supabase
      .from('orders')
      .select('id, status')
      .eq('tab_id', tabId)
      .in('status', CASCADE_FROM_STATUSES);

    if (ordersError) {
      console.error('[tabs/close] cascade order lookup failed', ordersError);
    } else {
      for (const order of cascadeOrders ?? []) {
        const fromStatus = order.status as OrderStatus;
        const result = await transitionOrderStatus(admin, {
          orderId: order.id,
          restaurantId: restaurant.id,
          from: fromStatus,
          to: 'completed',
        });
        if (result.ok) {
          cascadeOrderIds.push(order.id);
        } else {
          console.warn('[tabs/close] cascade transition skipped', {
            tabId,
            orderId: order.id,
            from: fromStatus,
            reason: result.reason,
          });
          cascadeSkipped.push(order.id);
        }
      }
    }
  }

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: guard.staff.id,
    eventType: 'tab.closed',
    tabId,
    eventData: {
      settlement,
      total_cents: tab.total_cents,
      reason: settlement === 'written_off' ? reason : null,
      cascade_order_ids: cascadeOrderIds,
      cascade_skipped: cascadeSkipped,
      table_id: tab.table_id,
      duration_minutes_open: Math.round((new Date(closedAtIso).getTime() - new Date(tab.opened_at).getTime()) / 60000),
    },
  });

  invalidateConsumerPage(restaurant.slug);

  return NextResponse.json(
    {
      ok: true,
      tab: { id: closedTab.id, status: closedTab.status, settlement: closedTab.settlement },
      cascaded_order_count: cascadeOrderIds.length,
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } },
  );
}
