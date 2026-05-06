import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'

/**
 * GET /[locale]/auth/confirm
 *
 * Handles two flows:
 *
 *   1. Magic link callback (signup activation) — type omitted or any other value.
 *   2. Password recovery — ?type=recovery (sent by /api/auth/forgot-password).
 *
 * Flow:
 *   1. Read `code` and `type` from searchParams.
 *   2. Exchange the code for a session (sets the auth cookies).
 *   3. Route the user:
 *        - type=recovery (any state)         → /onboarding/set-password
 *                                              (the same form is used to set a new password)
 *        - no restaurant row                 → /onboarding/set-password (first-time user)
 *        - restaurant.status = 'active'      → /dashboard (returning, fully onboarded)
 *        - any other status (draft, etc.)    → /onboarding (mid-onboarding)
 *   4. If the code is missing or the exchange fails:
 *        - error message contains "used"/"already" → /verify-email?error=used
 *        - everything else                          → /verify-email?error=expired
 *
 * The route preserves the active locale so Dutch lives at /auth/confirm and
 * English at /en/auth/confirm. Dutch is the default and has no prefix.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> }
) {
  const { locale } = await params
  const localePrefix = locale === 'en' ? '/en' : ''
  const origin = new URL(request.url).origin

  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')

  // 1. Code missing → treat as expired
  if (!code) {
    return NextResponse.redirect(
      `${origin}${localePrefix}/verify-email?error=expired`
    )
  }

  const supabase = await createSupabaseServerClient()

  // 2. Exchange the code for a session
  const { data: sessionData, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError || !sessionData?.user) {
    const message = (exchangeError?.message || '').toLowerCase()
    const usedAlready = message.includes('used') || message.includes('already')
    const errorParam = usedAlready ? 'used' : 'expired'
    return NextResponse.redirect(
      `${origin}${localePrefix}/verify-email?error=${errorParam}`
    )
  }

  // 3a. Recovery flow — always route to set-password regardless of restaurant state.
  // The user is now authenticated for one purpose: setting a new password.
  if (type === 'recovery') {
    return NextResponse.redirect(
      `${origin}${localePrefix}/onboarding/set-password`
    )
  }

  const userId = sessionData.user.id

  // 3b. Magic-link signup flow — look up the restaurant record for this user
  const { data: restaurant, error: restaurantError } = await supabase
    .from('restaurants')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle()

  // If the lookup itself errors (e.g. RLS or transient DB issue), fall back to
  // the safest option: send them to set-password. They can always re-run the
  // flow if the password is already set — the set-password page will redirect.
  if (restaurantError) {
    console.error('Restaurant lookup error in /auth/confirm:', restaurantError)
    return NextResponse.redirect(
      `${origin}${localePrefix}/onboarding/set-password`
    )
  }

  // 4. Route by state
  if (!restaurant) {
    // No restaurant row yet → first-time user, must set password
    return NextResponse.redirect(
      `${origin}${localePrefix}/onboarding/set-password`
    )
  }

  if (restaurant.status === 'active') {
    return NextResponse.redirect(`${origin}${localePrefix}/dashboard`)
  }

  // Any non-active status (draft, unverified, etc.) → continue onboarding
  return NextResponse.redirect(`${origin}${localePrefix}/onboarding`)
}
