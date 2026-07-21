// Session-authenticated; called by usePolling at 60s. No rate limit needed.
// Payload includes the D1.2 alert set (mollie/payments/orders/tabs/deposits/
// notifications) alongside the D1.1 tiles/timeline/queue data.

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

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!restaurant) {
    return NextResponse.json(
      { error: 'not_staff' },
      { status: 403, headers: { 'Cache-Control': 'private, no-store' } }
    )
  }

  // `restaurant` was already resolved via .eq('user_id', user.id), so the
  // caller is the owner by construction — no separate staff-row check
  // needed for access, but the Mollie alert (D1.2) is role-gated, so we
  // still need the role. Fall back to 'owner' if the D0.1 backfill row is
  // somehow missing (mirrors resolveDashboardContext's synthetic fallback).
  const { data: staffRow } = await supabase
    .from('restaurant_staff')
    .select('role')
    .eq('restaurant_id', restaurant.id)
    .eq('user_id', user.id)
    .is('deactivated_at', null)
    .maybeSingle()

  const role: StaffRole = staffRow?.role ?? 'owner'

  const payload = await getTodayPayload(restaurant.id, new Date(), role)

  return NextResponse.json(payload, {
    status: 200,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
