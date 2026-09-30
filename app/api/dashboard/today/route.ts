// Session-authenticated; called by usePolling at 60s. No rate limit needed.
// Payload includes the D1.2 alert set (mollie/payments/orders/tabs/deposits/
// notifications) alongside the D1.1 tiles/timeline/queue data.

import { assertDashboardWriteAllowed } from '@/lib/dashboard/guards/assertDashboardWriteAllowed'
import { selectActingRestaurant } from '@/lib/dashboard/staff/actingRestaurant'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getTodayPayload } from '@/lib/dashboard/queries/today'
import type { StaffRole } from '@/lib/dashboard/nav'

export async function GET() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'not_authenticated' },
      { status: 401, headers: { 'Cache-Control': 'private, no-store' } }
    )
  }

  const { data: restaurant } = await selectActingRestaurant(supabase, user.id, 'id')

  if (!restaurant) {
    return NextResponse.json(
      { error: 'not_staff' },
      { status: 403, headers: { 'Cache-Control': 'private, no-store' } }
    )
  }

  // Role check: today.read (service/kitchen/manager/owner per lib/dashboard/permissions.ts).
  const readGuard = await assertDashboardWriteAllowed(restaurant.id, 'today.read', user)
  if (!readGuard.ok) {
    return NextResponse.json(
      { error: readGuard.reason },
      { status: readGuard.httpStatus, headers: { 'Cache-Control': 'private, no-store' } },
    )
  }

  const role: StaffRole = readGuard.staff.role

  const payload = await getTodayPayload(restaurant.id, new Date(), role)

  return NextResponse.json(payload, {
    status: 200,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
