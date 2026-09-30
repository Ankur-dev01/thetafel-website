import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolveDestination } from '@/lib/auth/resolveDestination'
import { homePathFor } from '@/lib/dashboard/permissions'

/**
 * GET /api/auth/me/destination
 *
 * Returns the locale-prefixed path the authenticated user should be sent to.
 * Called by the login page client immediately after a successful login.
 *
 * Query params:
 *   - locale: 'nl' | 'en' (optional; defaults to 'nl')
 *
 * Returns: 200 { destination: string }
 *          401 { error: 'not_authenticated' } if the session is missing
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const localeRaw = url.searchParams.get('locale')
  const locale: 'nl' | 'en' = localeRaw === 'en' ? 'en' : 'nl'

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: 'not_authenticated' },
      { status: 401 }
    )
  }

  // Staff accounts (manager / service / kitchen) belong to the dashboard of the
  // restaurant they hold an active membership at — never to onboarding. A user
  // whose only memberships are deactivated is signed out with a message.
  const prefix = locale === 'en' ? '/en' : ''
  const { data: memberships } = await supabase
    .from('restaurant_staff')
    .select('role, restaurant_id, deactivated_at')
    .eq('user_id', user.id)
  const activeStaff = (memberships ?? []).find((m) => m.deactivated_at === null && m.role !== 'owner')
  if (activeStaff) {
    const { data: staffRestaurant } = await supabase
      .from('restaurants')
      .select('status')
      .eq('id', activeStaff.restaurant_id)
      .maybeSingle()
    if (staffRestaurant?.status === 'live') {
      return NextResponse.json({ destination: `${prefix}${homePathFor(activeStaff.role)}` }, { status: 200 })
    }
    return NextResponse.json({ destination: `${prefix}/login?error=account_unavailable` }, { status: 200 })
  }
  if ((memberships ?? []).length > 0 && (memberships ?? []).every((m) => m.deactivated_at !== null)) {
    const { data: owned } = await supabase.from('restaurants').select('id').eq('user_id', user.id).maybeSingle()
    if (!owned) {
      await supabase.auth.signOut()
      return NextResponse.json({ destination: `${prefix}/login?deactivated=1` }, { status: 200 })
    }
  }

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('status, current_onboarding_step')
    .eq('user_id', user.id)
    .maybeSingle()

  const destination = resolveDestination(restaurant ?? null, locale)
  return NextResponse.json({ destination }, { status: 200 })
}
