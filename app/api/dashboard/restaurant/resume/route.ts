// Session-authenticated, human-triggered, rare — no rate limit.

import { selectActingRestaurant } from '@/lib/dashboard/staff/actingRestaurant'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient, createSupabaseServerClientAdmin } from '@/lib/supabase/server'
import { assertDashboardWriteAllowed } from '@/lib/dashboard/guards/assertDashboardWriteAllowed'
import { dashboardAudit } from '@/lib/dashboard/audit/dashboardAudit'

export async function POST() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'not_authenticated' },
      { status: 401, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const { data: restaurant, error: fetchError } = await selectActingRestaurant(supabase, user.id, 'id, paused_at, pause_reason')

  if (fetchError || !restaurant) {
    return NextResponse.json(
      { error: 'restaurant_not_found' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const guard = await assertDashboardWriteAllowed(restaurant.id, 'restaurant.resume')
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.reason },
      { status: guard.httpStatus, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  if (restaurant.paused_at === null) {
    return NextResponse.json(
      { error: 'not_paused' },
      { status: 409, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  // Billing pauses are lifted ONLY by a successful payment (the webhook), never
  // from the dashboard. Also refuse a manual pause that coexists with a
  // suspended / cancelled subscription — resuming would put a non-paying
  // restaurant back online.
  if (restaurant.pause_reason === 'billing_suspended' || restaurant.pause_reason === 'subscription_cancelled') {
    return NextResponse.json(
      { error: restaurant.pause_reason },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const admin = await createSupabaseServerClientAdmin()
  const { data: sub } = await admin
    .from('subscriptions')
    .select('status')
    .eq('restaurant_id', restaurant.id)
    .in('status', ['suspended', 'cancelled'])
    .limit(1)
    .maybeSingle()
  if (sub) {
    return NextResponse.json(
      { error: sub.status === 'cancelled' ? 'subscription_cancelled' : 'billing_suspended' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const { error: updateError } = await supabase
    .from('restaurants')
    .update({
      paused_at: null,
      paused_by: null,
      pause_reason: null,
    })
    .eq('id', restaurant.id)

  if (updateError) {
    return NextResponse.json(
      { error: 'update_failed' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  await dashboardAudit({
    restaurantId: restaurant.id,
    staffId: guard.staff.id,
    eventType: 'restaurant.resumed',
    eventData: {},
  })

  return NextResponse.json({ ok: true }, { status: 200, headers: { 'Cache-Control': 'no-store' } })
}
