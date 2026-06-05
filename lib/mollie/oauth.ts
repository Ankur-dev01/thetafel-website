import { getMollieOAuthClient, getMollieOAuthConfig } from './client'

/**
 * Scopes requested when a restaurant authorizes The Tafel to act on
 * its behalf. Least-privilege set covering everything onboarding +
 * the booking/order phases need. Additional scopes can be added
 * later; doing so requires re-authorization by existing restaurants.
 */
export const MOLLIE_OAUTH_SCOPES = [
  'organizations.read',
  'onboarding.read',
  'payments.read',
  'payments.write',
  'customers.read',
  'customers.write',
  'mandates.read',
  'mandates.write',
  'subscriptions.read',
  'subscriptions.write',
  'profiles.read',
] as const

const AUTHORIZE_BASE = 'https://my.mollie.com/oauth2/authorize'
const TOKEN_ENDPOINT = 'https://api.mollie.com/oauth2/tokens'

export interface MollieTokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  scope: string
}

/**
 * Build the URL the restaurant's browser is sent to in order to
 * initiate the OAuth flow. The state value must be unguessable and
 * checked on return — it's the CSRF defence.
 */
export function buildAuthorizeUrl({ state }: { state: string }): string {
  const { clientId, redirectUri } = getMollieOAuthConfig()

  const params = new URLSearchParams({
    client_id: clientId,
    scope: MOLLIE_OAUTH_SCOPES.join(' '),
    state,
    response_type: 'code',
    approval_prompt: 'auto',
    redirect_uri: redirectUri,
  })

  return `${AUTHORIZE_BASE}?${params.toString()}`
}

/**
 * Exchange an OAuth authorization code (delivered to the callback)
 * for a token pair. Uses HTTP Basic auth with the OAuth app's
 * credentials, per Mollie's docs.
 */
export async function exchangeCodeForTokens(code: string): Promise<MollieTokenResponse> {
  const { clientId, clientSecret, redirectUri } = getMollieOAuthConfig()

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  })

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`mollie_token_exchange_failed:${res.status}:${text.slice(0, 200)}`)
  }

  const json = (await res.json()) as MollieTokenResponse
  if (!json.access_token || !json.refresh_token) {
    throw new Error('mollie_token_response_incomplete')
  }
  return json
}

/**
 * Exchange a refresh token for a new access token. Used by future
 * code paths (booking, subscription billing) when the current access
 * token is near or past expiry. Not called by D6.2 directly.
 */
export async function refreshAccessToken(refreshToken: string): Promise<MollieTokenResponse> {
  const { clientId, clientSecret } = getMollieOAuthConfig()

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  })

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: body.toString(),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`mollie_token_refresh_failed:${res.status}:${text.slice(0, 200)}`)
  }

  const json = (await res.json()) as MollieTokenResponse
  if (!json.access_token) {
    throw new Error('mollie_refresh_response_incomplete')
  }
  return json
}

/**
 * Fetch the Mollie organization id for the org that was just
 * connected. Uses the freshly-issued access token via the SDK's
 * organizations.getCurrent() endpoint.
 */
export async function fetchConnectedOrganizationId(accessToken: string): Promise<string> {
  const client = getMollieOAuthClient(accessToken)
  const org = await client.organizations.getCurrent()
  if (!org?.id) {
    throw new Error('mollie_org_lookup_missing_id')
  }
  return org.id
}
