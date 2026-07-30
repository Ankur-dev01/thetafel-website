// app/api/dashboard/bookings/[id]/no-show/route.ts
//
// POST /api/dashboard/bookings/{id}/no-show
//
// Marks a confirmed booking as a no-show. Only allowed once the 30-minute
// grace period after slot_time has elapsed — a guest who is merely 10
// minutes late must not get flagged prematurely. No slot lock: this has no
// capacity implication, just a status flip.

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient, createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { assertDashboardWriteAllowed } from '@/lib/dashboard/guards/assertDashboardWriteAllowed';
import { dashboardMutationRateLimit } from '@/lib/dashboard/rateLimit';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { transitionBookingStatus } from '@/lib/booking/transitionBookingStatus';
import { invalidateConsumerPage } from '@/lib/consumer/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const GRACE_MINUTES = 30;

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
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

  const { data: restaurant, error: restaurantError } = await supabase
    .from('restaurants')
    .select('id, slug')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (restaurantError || !restaurant) {
    return NextResponse.json({ error: 'restaurant_not_found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  const guard = await assertDashboardWriteAllowed(restaurant.id, 'booking.mark_no_show');
  if (!guard.ok) {
    return NextResponse.json({ error: guard.reason }, { status: guard.httpStatus, headers: { 'Cache-Control': 'no-store' } });
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, slot_time, party_size')
    .eq('id', bookingId)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle();
  if (!booking) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  if (booking.status !== 'confirmed') {
    const code = booking.status === 'no_show' ? 'already_no_show' : 'terminal_state';
    return NextResponse.json({ error: code }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
  }

  const slotMs = new Date(booking.slot_time).getTime();
  const minutesAfterSlot = (Date.now() - slotMs) / 60_000;
  if (minutesAfterSlot < GRACE_MINUTES) {
    return NextResponse.json({ error: 'too_early' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
  }

  const admin = await createSupabaseServerClientAdmin();
  const result = await transitionBookingStatus(admin, bookingId, restaurant.id, 'confirmed', 'no_show');

  if (!result.ok) {
    console.error('[bookings/no-show] transition failed', result.error);
    return NextResponse.json({ error: 'update_failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!result.transitioned) {
    return NextResponse.json({ error: 'already_no_show' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
  }

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: guard.staff.id,
    eventType: 'booking.marked_no_show',
    eventData: { minutes_after_slot: Math.round(minutesAfterSlot), party_size: booking.party_size },
    bookingId,
  });

  invalidateConsumerPage(restaurant.slug);

  return NextResponse.json({ ok: true, booking: result.booking }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
