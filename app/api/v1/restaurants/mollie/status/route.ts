import { NextResponse, type NextRequest } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * Lightweight read of the restaurant's Mollie state for the Step 11
 * page to poll. Never returns tokens — only signals the UI uses.
 */
export async function GET(_req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { data: restaurant, error: restErr } = await supabase
    .from('restaurants')
    .select(
      'mollie_status, mollie_organization_id, mollie_initiated_at, mollie_verified_at'
    )
    .eq('user_id', user.id)
    .maybeSingle()

  if (restErr || !restaurant) {
    return NextResponse.json({ error: 'restaurant_not_found' }, { status: 404 })
  }

  const has_organization = Boolean(restaurant.mollie_organization_id)

  return NextResponse.json(
    {
      mollie_status: restaurant.mollie_status,
      has_organization,
      mollie_initiated_at: restaurant.mollie_initiated_at,
      mollie_verified_at: restaurant.mollie_verified_at,
      can_continue: has_organization,
    },
    { status: 200, headers: { 'Cache-Control': 'no-store' } }
  )
}
