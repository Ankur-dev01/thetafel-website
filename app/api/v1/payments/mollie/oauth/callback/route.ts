import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  exchangeCodeForTokens,
  fetchConnectedOrganizationId,
} from '@/lib/mollie/oauth'
import { invalidateOnboardingLayout } from '@/lib/onboarding/cache'

const STATE_COOKIE_NAME = 'mollie_oauth_state'

/**
 * Parse the state value that we built in the init route.
 * Shape: `<nonce>.<locale>`. Defensive against malformed input.
 */
function parseState(state: string | null): { nonce: string; locale: 'nl' | 'en' } | null {
  if (!state) return null
  const dotIdx = state.lastIndexOf('.')
  if (dotIdx < 1 || dotIdx === state.length - 1) return null
  const nonce = state.slice(0, dotIdx)
  const localeRaw = state.slice(dotIdx + 1)
  const locale = localeRaw === 'en' ? 'en' : 'nl'
  return { nonce, locale }
}

function redirectToPayments(
  req: NextRequest,
  locale: 'nl' | 'en',
  params: Record<string, string>
) {
  const url = new URL(`/${locale}/onboarding/payments`, req.url)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return NextResponse.redirect(url)
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const stateParam = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')
  const oauthErrorDesc = url.searchParams.get('error_description')

  const parsed = parseState(stateParam)
  const locale: 'nl' | 'en' = parsed?.locale ?? 'nl'

  // Read and immediately clear the state cookie regardless of outcome
  const cookieStore = await cookies()
  const expectedNonce = cookieStore.get(STATE_COOKIE_NAME)?.value
  cookieStore.delete(STATE_COOKIE_NAME)

  // 1. Did Mollie report an error in the redirect?
  if (oauthError) {
    return redirectToPayments(req, locale, {
      mollie: 'error',
      reason: oauthError,
      detail: (oauthErrorDesc ?? '').slice(0, 200),
    })
  }

  // 2. Required params present?
  if (!code || !parsed) {
    return redirectToPayments(req, locale, { mollie: 'error', reason: 'missing_params' })
  }

  // 3. State matches?
  if (!expectedNonce || parsed.nonce !== expectedNonce) {
    return redirectToPayments(req, locale, { mollie: 'error', reason: 'state_mismatch' })
  }

  // 4. Still logged in?
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
    error: authErr,
  } = await supabase.auth.getUser()
  if (authErr || !user) {
    return redirectToPayments(req, locale, { mollie: 'error', reason: 'unauthorized' })
  }

  // 5. Restaurant present?
  const { data: restaurant, error: restErr } = await supabase
    .from('restaurants')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (restErr || !restaurant) {
    return redirectToPayments(req, locale, { mollie: 'error', reason: 'restaurant_not_found' })
  }

  // 6. Exchange code for tokens.
  let tokens
  try {
    tokens = await exchangeCodeForTokens(code)
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[mollie/oauth/callback] token exchange failed:', err instanceof Error ? err.message : err)
    }
    return redirectToPayments(req, locale, { mollie: 'error', reason: 'token_exchange_failed' })
  }

  // 7. Look up the connected organization id.
  let organizationId
  try {
    organizationId = await fetchConnectedOrganizationId(tokens.access_token)
  } catch (err) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[mollie/oauth/callback] org lookup failed:', err instanceof Error ? err.message : err)
    }
    return redirectToPayments(req, locale, { mollie: 'error', reason: 'organization_fetch_failed' })
  }

  // 8. Persist everything. mollie_status stays at 'pending' here.
  //    The webhook (D6.4) flips it to 'verified' when Mollie completes KYC.
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString()

  const { error: persistErr } = await supabase
    .from('restaurants')
    .update({
      mollie_access_token: tokens.access_token,
      mollie_refresh_token: tokens.refresh_token,
      mollie_token_expires_at: expiresAt,
      mollie_organization_id: organizationId,
    })
    .eq('id', restaurant.id)

  if (persistErr) {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[mollie/oauth/callback] persist failed:', persistErr.message)
    }
    return redirectToPayments(req, locale, { mollie: 'error', reason: 'persist_failed' })
  }

  invalidateOnboardingLayout()

  return redirectToPayments(req, locale, { mollie: 'connected' })
}
