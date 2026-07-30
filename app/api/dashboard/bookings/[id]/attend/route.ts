// app/api/dashboard/bookings/[id]/attend/route.ts
//
// POST /api/dashboard/bookings/{id}/attend
//
// Marks a booking as attended right now. Allowed from pending/confirmed only.
// Slot-locked because a walk-in (D2.4) could race the same tables at the
// same instant.

import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient, createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { assertDashboardWriteAllowed } from '@/lib/dashboard/guards/assertDashboardWriteAllowed';
import { dashboardMutationRateLimit } from '@/lib/dashboard/rateLimit';
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit';
import { transitionBookingStatus } from '@/lib/booking/transitionBookingStatus';
import { invalidateConsumerPage } from '@/lib/consumer/cache';
import { acquireSlotLock, releaseSlotLock } from '@/lib/booking/slotLock';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  const guard = await assertDashboardWriteAllowed(restaurant.id, 'booking.mark_attended');
  if (!guard.ok) {
    return NextResponse.json({ error: guard.reason }, { status: guard.httpStatus, headers: { 'Cache-Control': 'no-store' } });
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('id, status, slot_time, party_size, zone_id')
    .eq('id', bookingId)
    .eq('restaurant_id', restaurant.id)
    .maybeSingle();
  if (!booking) {
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  }

  if (booking.status === 'attended') {
    return NextResponse.json({ error: 'already_attended' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
  }
  if (booking.status !== 'pending' && booking.status !== 'confirmed') {
    return NextResponse.json({ error: 'terminal_state' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
  }

  const lock = await acquireSlotLock(restaurant.id, booking.slot_time);
  if (!lock.ok) {
    return NextResponse.json({ error: 'slot_temporarily_busy' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const admin = await createSupabaseServerClientAdmin();
    const attendedAt = new Date().toISOString();

    const result = await transitionBookingStatus(admin, bookingId, restaurant.id, booking.status, 'attended', {
      attended_at: attendedAt,
      attended_marked_by: guard.staff.id,
    });

    if (!result.ok) {
      console.error('[bookings/attend] transition failed', result.error);
      return NextResponse.json({ error: 'update_failed' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }
    if (!result.transitioned) {
      return NextResponse.json({ error: 'already_attended' }, { status: 409, headers: { 'Cache-Control': 'no-store' } });
    }

    await dashboardAudit({
      restaurantId: restaurant.id,
      staffId: guard.staff.id,
      eventType: 'booking.marked_attended',
      eventData: { from_status: booking.status, attended_at: attendedAt, party_size: booking.party_size },
      bookingId,
    });

    invalidateConsumerPage(restaurant.slug);

    return NextResponse.json(
      { ok: true, booking: result.booking },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    );
  } finally {
    await releaseSlotLock(lock.token, restaurant.id, booking.slot_time);
  }
}
