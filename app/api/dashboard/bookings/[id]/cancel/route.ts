// app/api/dashboard/bookings/[id]/cancel/route.ts
//
// POST /api/dashboard/bookings/{id}/cancel
// Body: { reason?: string }
//
// Cancels a booking from staff-side. No refund flow here — D6.4 builds that;
// this route only captures the deposit state at cancel time in the audit
// event_data so D6.4 can retroactively find historic cancels-with-paid-
// deposits. No slot lock: cancel is release-only, nothing else can race it.

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient, createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { assertDashboardWriteAllowed } from '@/lib/dashboard/guards/assertDashboardWriteAllowed';
import { dashboardMutationRateLimit } from '@/lib/dashboard/rateLimit';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { transitionBookingStatus } from '@/lib/booking/transitionBookingStatus';
import { invalidateConsumerPage } from '@/lib/consumer/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DepositState = 'not_required' | 'pending' | 'paid' | 'failed' | 'refunded';

function deriveDepositState(depositAmountCents: number | null, intentStatus: string | null): DepositState {
  if (depositAmountCents === null || depositAmountCents <= 0) return 'not_required';
  if (intentStatus === null) return 'pending';
  if (intentStatus === 'paid') return 'paid';
  if (intentStatus === 'failed' || intentStatus === 'cancelled') return 'failed';
  if (intentStatus === 'refunded' || intentStatus === 'partially_refunded') return 'refunded';
  return 'pending';
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id: bookingId } = await ctx.params;

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

  let reason: string | null = null;
  try {
    const body = await req.json().catch(() => ({}));
    if (typeof body?.reason === 'string') {
      const trimmed = body.reason.trim();
      reason = trimmed.length > 0 ? trimmed.slice(0, 500) : null;
    }
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
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

  const guard = await assertDashboardWriteAllowed(restaurant.id, 'booking.cancel');
  if (!guard.ok) {
    return NextResponse.json({ error: guard.reason }, { status: guard.httpStatus, headers: { 'Cache-Control': 'no-store' } });
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, deposit_amount_cents, deposit_intent_id')
    .eq('id', bookingId)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle();
  if (!booking) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  if (booking.status === 'cancelled') {
    return NextResponse.json({ error: 'already_cancelled' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
  }
  if (booking.status !== 'pending' && booking.status !== 'confirmed' && booking.status !== 'attended') {
    return NextResponse.json({ error: 'terminal_state' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
  }

  let intentStatus: string | null = null;
  if (booking.deposit_intent_id) {
    const { data: intent } = await supabase
      .from('payment_intents')
      .select('status')
      .eq('id', booking.deposit_intent_id)
      .maybeSingle();
    intentStatus = intent?.status ?? null;
  }
  const depositState = deriveDepositState(booking.deposit_amount_cents, intentStatus);

  const admin = await createSupabaseServerClientAdmin();
  const cancelledAt = new Date().toISOString();

  const result = await transitionBookingStatus(admin, bookingId, restaurant.id, booking.status, 'cancelled', {
    cancelled_at: cancelledAt,
    cancelled_by: 'restaurant',
    cancellation_reason: reason,
  });

  if (!result.ok) {
    console.error('[bookings/cancel] transition failed', result.error);
    return NextResponse.json({ error: 'update_failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!result.transitioned) {
    return NextResponse.json({ error: 'already_cancelled' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
  }

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: guard.staff.id,
    eventType: 'booking.cancelled_by_staff',
    eventData: {
      from_status: booking.status,
      reason,
      deposit_state: depositState,
      deposit_amount_cents: booking.deposit_amount_cents,
      deposit_intent_id: booking.deposit_intent_id,
    },
    bookingId,
  });

  invalidateConsumerPage(restaurant.slug);

  return NextResponse.json({ ok: true, booking: result.booking }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
