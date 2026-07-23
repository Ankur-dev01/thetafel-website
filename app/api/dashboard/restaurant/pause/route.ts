// Session-authenticated, human-triggered, rare — no rate limit.

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
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

  const { data: restaurant, error: fetchError } = await supabase
    .from('restaurants')
    .select('id, paused_at')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (fetchError || !restaurant) {
    return NextResponse.json(
      { error: 'restaurant_not_found' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const guard = await assertDashboardWriteAllowed(restaurant.id, 'restaurant.pause')
  if (!guard.ok) {
    return NextResponse.json(
      { error: guard.reason },
      { status: guard.httpStatus, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  if (restaurant.paused_at !== null) {
    return NextResponse.json(
      { error: 'already_paused' },
      { status: 409, headers: { 'Cache-Control': 'no-store' } }
    )
  }

  const pausedAt = new Date().toISOString()

  const { error: updateError } = await supabase
    .from('restaurants')
    .update({
      paused_at: pausedAt,
      paused_by: guard.staff.id,
      pause_reason: 'manual',
      grace_period_started_at: null,
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
    eventType: 'restaurant.paused',
    eventData: { reason: 'manual' },
  })

  return NextResponse.json(
    { ok: true, paused_at: pausedAt },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  )
}
