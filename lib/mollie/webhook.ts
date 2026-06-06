import { createHmac, timingSafeEqual } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  getMollieOAuthClient,
  getMollieOAuthConfig,
} from './client'
import { refreshAccessToken } from './oauth'

export type MollieStatus =
  | 'not_started'
  | 'pending'
  | 'verified'
  | 'rejected'
  | 'needs_action'

const SIGNATURE_HEADER = 'x-mollie-signature'

/**
 * Constant-time verification of the Mollie webhook signature.
 * Format: 'sha256=<base64_hmac_of_raw_body>'.
 */
export function verifyMollieSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): boolean {
  if (!signatureHeader || !secret) return false

  const provided = signatureHeader.startsWith('sha256=')
    ? signatureHeader.slice('sha256='.length)
    : signatureHeader

  const expected = createHmac('sha256', secret).update(rawBody).digest('base64')

  const a = Buffer.from(provided, 'utf8')
  const b = Buffer.from(expected, 'utf8')
  if (a.length !== b.length) return false

  try {
    return timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function getMollieSignatureHeaderName(): string {
  return SIGNATURE_HEADER
}

/**
 * Map Mollie's onboarding status to our enum.
 *
 *   'needs-data'  → 'needs_action'
 *   'in-review'   → 'pending'
 *   'completed'   → 'verified'
 *
 * Unrecognised values fall back to 'pending' to avoid accidentally
 * marking a half-onboarded restaurant as verified.
 */
export function mapOnboardingStatus(mollieStatus: string | null | undefined): MollieStatus {
  switch (mollieStatus) {
    case 'completed':
      return 'verified'
    case 'in-review':
      return 'pending'
    case 'needs-data':
      return 'needs_action'
    default:
      return 'pending'
  }
}

/**
 * Resolve the connected restaurant's access token, refreshing if within
 * 60 s of expiry. Persists the refreshed pair back to the restaurant row.
 */
export async function getValidAccessTokenForRestaurant(
  admin: SupabaseClient,
  restaurantId: string
): Promise<string> {
  const { data: restaurant, error } = await admin
    .from('restaurants')
    .select('mollie_access_token, mollie_refresh_token, mollie_token_expires_at')
    .eq('id', restaurantId)
    .maybeSingle()

  if (error || !restaurant) {
    throw new Error(`restaurant_not_found_for_token:${restaurantId}`)
  }

  const accessToken = restaurant.mollie_access_token
  const refreshToken = restaurant.mollie_refresh_token
  const expiresAt = restaurant.mollie_token_expires_at

  if (!accessToken || !refreshToken) {
    throw new Error(`restaurant_missing_mollie_tokens:${restaurantId}`)
  }

  const expiresAtMs = expiresAt ? new Date(expiresAt).getTime() : 0
  const shouldRefresh = expiresAtMs - Date.now() < 60_000

  if (!shouldRefresh) {
    return accessToken
  }

  const refreshed = await refreshAccessToken(refreshToken)
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString()

  const { error: persistErr } = await admin
    .from('restaurants')
    .update({
      mollie_access_token: refreshed.access_token,
      mollie_refresh_token: refreshed.refresh_token,
      mollie_token_expires_at: newExpiresAt,
    })
    .eq('id', restaurantId)

  if (persistErr) {
    throw new Error(`token_refresh_persist_failed:${persistErr.message}`)
  }

  return refreshed.access_token
}

/**
 * Fetch the onboarding status of the connected organization using its
 * OAuth access token. Returns the raw Mollie status string.
 */
export async function fetchOnboardingStatus(accessToken: string): Promise<string | null> {
  const client = getMollieOAuthClient(accessToken)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onboardingApi = (client as any).onboarding
  if (!onboardingApi || typeof onboardingApi.get !== 'function') {
    // SDK shape changed — fall back to raw fetch
    const res = await fetch('https://api.mollie.com/v2/onboarding/me', {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    })
    if (!res.ok) throw new Error(`onboarding_fetch_failed:${res.status}`)
    const json = (await res.json()) as { status?: string }
    return json?.status ?? null
  }
  const onboarding = await onboardingApi.get()
  return (onboarding as { status?: string })?.status ?? null
}

// Silence unused warning until programmatic webhook registration lands
void getMollieOAuthConfig
