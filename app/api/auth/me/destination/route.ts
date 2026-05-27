import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolveDestination } from '@/lib/auth/resolveDestination'

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

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('status, current_onboarding_step')
    .eq('user_id', user.id)
    .maybeSingle()

  const destination = resolveDestination(restaurant ?? null, locale)
  return NextResponse.json({ destination }, { status: 200 })
}
