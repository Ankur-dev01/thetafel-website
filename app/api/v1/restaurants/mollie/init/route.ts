import { NextResponse, type NextRequest } from 'next/server'
import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buildAuthorizeUrl } from '@/lib/mollie/oauth'
import { assertOnboardingMutationForUser } from '@/lib/onboarding/guards'
import { invalidateOnboardingLayout } from '@/lib/onboarding/cache'
import { assertDashboardWriteAllowed } from '@/lib/dashboard/guards/assertDashboardWriteAllowed'
import { MOLLIE_RETURN_TO_COOKIE, parseMollieReturnTo } from '@/lib/mollie/returnTo'

const STATE_COOKIE_NAME = 'mollie_oauth_state'
const STATE_COOKIE_MAX_AGE_SECONDS = 600 // 10 minutes — covers the OAuth round-trip

const bodySchema = z
  .object({
    locale: z.enum(['nl', 'en']).optional().default('nl'),
    // Dashboard reconnect only; whitelisted by parseMollieReturnTo below.
    returnTo: z.string().optional(),
  })
  .strict()

export async function POST(req: NextRequest) {
  // 1. Parse body (optional locale only)
  let parsedBody: { locale: 'nl' | 'en'; returnTo?: string } = { locale: 'nl' }
  try {
    const raw = await req.json()
    const parsed = bodySchema.safeParse(raw)
    if (parsed.success) parsedBody = parsed.data
  } catch {
    // Empty body or non-JSON — default locale, fall through.
  }

  // 2. Auth + guard. Two modes:
  //    - onboarding (default): restaurant must still be in 'onboarding'.
  //    - dashboard reconnect (returnTo present + whitelisted): the live
  //      restaurant's owner re-runs the OAuth handshake from
  //      /dashboard/settings/payments. A returnTo that isn't on the whitelist
  //      is rejected rather than silently falling back to onboarding.
  const supabase = await createSupabaseServerClient()
  const returnTo = parsedBody.returnTo === undefined ? null : parseMollieReturnTo(parsedBody.returnTo)
  if (parsedBody.returnTo !== undefined && !returnTo) {
    return NextResponse.json({ error: 'invalid_return_to' }, { status: 400 })
  }

  let restaurant: { id: string; mollie_initiated_at: string | null; mollie_status?: string | null }
  if (returnTo) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

    const { data: owned } = await supabase
      .from('restaurants')
      .select('id, mollie_initiated_at, mollie_status')
      .eq('user_id', user.id)
      .is('deleted_at', null)
      .maybeSingle()
    if (!owned) return NextResponse.json({ error: 'restaurant_not_found' }, { status: 404 })

    const allowed = await assertDashboardWriteAllowed(owned.id, 'settings.payments.reconnect', user)
    if (!allowed.ok) {
      return NextResponse.json({ error: allowed.reason }, { status: allowed.httpStatus })
    }
    restaurant = owned
  } else {
    const guard = await assertOnboardingMutationForUser(supabase)
    if (!guard.ok) return guard.response
    restaurant = guard.restaurant
  }

  // 3. Generate CSRF state and encode the locale so the callback can
  //    redirect to the right /<locale>/ path.
  const nonce = randomBytes(32).toString('hex')
  const state = `${nonce}.${parsedBody.locale}`

  // 5. Persist the nonce in an HttpOnly cookie. The callback compares
  //    nonces; locale is read from the state URL param (lower trust,
  //    not security-sensitive).
  const cookieStore = await cookies()
  cookieStore.set(STATE_COOKIE_NAME, nonce, {
    httpOnly: true,
    sameSite: 'lax', // must be lax (not strict) so the cookie survives
    // the cross-site redirect back from my.mollie.com to localhost / thetafel.nl.
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
  })

  if (returnTo) {
    cookieStore.set(MOLLIE_RETURN_TO_COOKIE, returnTo, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: STATE_COOKIE_MAX_AGE_SECONDS,
    })
    // Reconnect leaves mollie_status alone: a verified restaurant whose tokens
    // went stale must not be downgraded to 'pending' just for re-authorising.
    // Only a restaurant that never started is moved to 'pending' (as onboarding does).
    if (!restaurant.mollie_status || restaurant.mollie_status === 'not_started') {
      const { error: pendingErr } = await supabase
        .from('restaurants')
        .update({
          mollie_status: 'pending',
          ...(restaurant.mollie_initiated_at == null
            ? { mollie_initiated_at: new Date().toISOString() }
            : {}),
        })
        .eq('id', restaurant.id)
      if (pendingErr) {
        return NextResponse.json({ error: 'restaurant_update_failed' }, { status: 500 })
      }
    }
    let reconnectUrl: string
    try {
      reconnectUrl = buildAuthorizeUrl({ state })
    } catch (err) {
      return NextResponse.json(
        { error: 'mollie_config_missing', detail: err instanceof Error ? err.message : 'unknown_config_error' },
        { status: 500 }
      )
    }
    return NextResponse.json({ authorize_url: reconnectUrl }, { status: 200 })
  }

  // 6. Flip mollie_status to 'pending'. Stamp mollie_initiated_at only
  //    if this is the first initiation — re-clicks of the button leave
  //    the original first-initiation timestamp untouched.
  const updatePayload: Record<string, unknown> = {
    mollie_status: 'pending',
  }
  if (restaurant.mollie_initiated_at == null) {
    updatePayload.mollie_initiated_at = new Date().toISOString()
  }

  const { error: updateErr } = await supabase
    .from('restaurants')
    .update(updatePayload)
    .eq('id', restaurant.id)
  if (updateErr) {
    return NextResponse.json({ error: 'restaurant_update_failed' }, { status: 500 })
  }
  invalidateOnboardingLayout()

  // 7. Build the URL and return it. The frontend opens this in a new
  //    tab (per PRD §8 D6.2.3) or full-page redirects — its choice.
  let authorize_url: string
  try {
    authorize_url = buildAuthorizeUrl({ state })
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.error('[mollie/init] authorize URL build failed:', err instanceof Error ? err.message : err)
    }
    return NextResponse.json(
      { error: 'mollie_config_missing', detail: err instanceof Error ? err.message : 'unknown_config_error' },
      { status: 500 }
    )
  }

  return NextResponse.json({ authorize_url }, { status: 200 })
}
