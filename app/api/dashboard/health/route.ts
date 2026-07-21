// No rate limit: session-authenticated only, low cost, called by the
// dashboard polling hook's "Verbinding verbroken" retry path.

import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createSupabaseServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ ok: false, reason: 'not_authenticated' }, { status: 401 })
  }

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!restaurant) {
    return NextResponse.json({ ok: false, reason: 'no_restaurant' }, { status: 404 })
  }

  const { data: staffRow } = await supabase
    .from('restaurant_staff')
    .select('role')
    .eq('restaurant_id', restaurant.id)
    .eq('user_id', user.id)
    .is('deactivated_at', null)
    .maybeSingle()

  return NextResponse.json({
    ok: true,
    restaurant_id: restaurant.id,
    staff_role: staffRow?.role ?? null,
  })
}
