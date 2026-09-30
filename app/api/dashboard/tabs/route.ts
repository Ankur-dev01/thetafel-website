// app/api/dashboard/tabs/route.ts
//
// GET /api/dashboard/tabs → 200 TabsPayload | 401 | 403
//
// Session-authenticated; called by usePolling at 30s (matches the orders
// page's cadence — tabs move at the same operational tempo). Read-only,
// RLS-scoped throughout. No rate limit needed.

import { assertDashboardWriteAllowed } from '@/lib/dashboard/guards/assertDashboardWriteAllowed'
import { selectActingRestaurant } from '@/lib/dashboard/staff/actingRestaurant'
import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getTabsPayload } from '@/lib/dashboard/queries/tabs'

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

  // Role check: tab.read (service/kitchen/manager/owner per lib/dashboard/permissions.ts).
  const readGuard = await assertDashboardWriteAllowed(restaurant.id, 'tab.read', user)
  if (!readGuard.ok) {
    return NextResponse.json(
      { error: readGuard.reason },
      { status: readGuard.httpStatus, headers: { 'Cache-Control': 'private, no-store' } },
    )
  }

  const payload = await getTabsPayload(restaurant.id, new Date())

  return NextResponse.json(payload, {
    status: 200,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
