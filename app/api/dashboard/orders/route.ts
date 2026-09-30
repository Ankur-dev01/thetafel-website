// app/api/dashboard/orders/route.ts
//
// GET /api/dashboard/orders → 200 OrdersPayload | 401 | 403
//
// Session-authenticated; called by usePolling at 30s (orders move faster
// than bookings — see D1.1's 60s cadence on /api/dashboard/today for
// contrast). Read-only, RLS-scoped throughout. No rate limit needed.

import { assertDashboardWriteAllowed } from '@/lib/dashboard/guards/assertDashboardWriteAllowed'
import { selectActingRestaurant } from '@/lib/dashboard/staff/actingRestaurant'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getOrdersPayload } from '@/lib/dashboard/queries/orders'

export async function GET() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'not_authenticated' },
      { status: 401, headers: { 'Cache-Control': 'private, no-store' } },
    )
  }

  const { data: restaurant } = await selectActingRestaurant(supabase, user.id, 'id')

  if (!restaurant) {
    return NextResponse.json(
      { error: 'not_staff' },
      { status: 403, headers: { 'Cache-Control': 'private, no-store' } },
    )
  }

  // Role check: order.read (service/kitchen/manager/owner per lib/dashboard/permissions.ts).
  const readGuard = await assertDashboardWriteAllowed(restaurant.id, 'order.read', user)
  if (!readGuard.ok) {
    return NextResponse.json(
      { error: readGuard.reason },
      { status: readGuard.httpStatus, headers: { 'Cache-Control': 'private, no-store' } },
    )
  }

  const payload = await getOrdersPayload(restaurant.id, new Date())

  return NextResponse.json(payload, {
    status: 200,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
