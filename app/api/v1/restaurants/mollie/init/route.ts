import { NextResponse, type NextRequest } from 'next/server'
import { randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { z } from 'zod'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { buildAuthorizeUrl } from '@/lib/mollie/oauth'

const STATE_COOKIE_NAME = 'mollie_oauth_state'
const STATE_COOKIE_MAX_AGE_SECONDS = 600 // 10 minutes — covers the OAuth round-trip

const bodySchema = z
  .object({
    locale: z.enum(['nl', 'en']).optional().default('nl'),
  })
  .strict()

export async function POST(req: NextRequest) {
  // 1. Parse body (optional locale only)
  let parsedBody: { locale: 'nl' | 'en' } = { locale: 'nl' }
  try {
    const raw = await req.json()
    const parsed = bodySchema.safeParse(raw)
    if (parsed.success) parsedBody = parsed.data
  } catch {
    // Empty body or non-JSON — default locale, fall through.
  }

  // 2. Auth
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  // 3. Restaurant lookup
  const { data: restaurant, error: restErr } = await supabase
    .from('restaurants')
    .select('id, mollie_status, mollie_initiated_at')
    .eq('user_id', user.id)
    .maybeSingle()
  if (restErr || !restaurant) {
    return NextResponse.json({ error: 'restaurant_not_found' }, { status: 404 })
  }

  // 4. Generate CSRF state and encode the locale so the callback can
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
