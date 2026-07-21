// Session-authenticated; called by usePolling at 60s. No rate limit needed.

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { getTodayPayload } from '@/lib/dashboard/queries/today'

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
  // needed here (unlike routes reached without that owner-scoped lookup).

  const payload = await getTodayPayload(restaurant.id, new Date())

  return NextResponse.json(payload, {
    status: 200,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
