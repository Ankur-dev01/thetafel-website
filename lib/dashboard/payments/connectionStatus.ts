import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { getMollieOAuthClient } from '@/lib/mollie/client'
import {
  fetchOnboardingStatus,
  getValidAccessTokenForRestaurant,
  mapOnboardingStatus,
} from '@/lib/mollie/webhook'

/**
 * Mollie connection state for the owner-facing payments page (PRD §4.8.9).
 *
 *   connected     — stored status 'verified' AND a live Mollie call succeeds
 *   expired       — tokens can't be refreshed / Mollie rejects them
 *   action_needed — Mollie org exists but status is pending / needs_action / rejected
 *   not_connected — never connected (not_started, or a handshake never finished)
 */
export type MollieConnectionState =
  | 'connected'
  | 'expired'
  | 'action_needed'
  | 'not_connected'

export type MollieConnectionRow = {
  mollie_status: string | null
  mollie_organization_id: string | null
  mollie_access_token: string | null
  mollie_token_expires_at: string | null
  mollie_verified_at: string | null
}

export type MollieConnectionInfo = {
  state: MollieConnectionState
  /** True when Mollie couldn't be reached for the live check (stored status shown). */
  liveCheckUnavailable: boolean
  /** True only when the live check itself observed an auth failure. */
  liveAuthFailed: boolean
  organizationIdMasked: string | null
  verifiedAt: string | null
}

const LIVE_CHECK_TIMEOUT_MS = 5000

export const MOLLIE_CONNECTION_COLUMNS =
  'mollie_status, mollie_organization_id, mollie_access_token, mollie_token_expires_at, mollie_verified_at'

/**
 * The "a connection that existed and stopped working" predicate shared by the
 * Today alert and the owner email. Never true for a restaurant that never
 * connected — 'not_started' / 'pending' are onboarding, not breakage.
 */
export function isMollieBrokenRow(
  row: Pick<MollieConnectionRow, 'mollie_status' | 'mollie_access_token' | 'mollie_token_expires_at'>,
  now: Date,
): boolean {
  const tokenExpired =
    row.mollie_token_expires_at !== null &&
    new Date(row.mollie_token_expires_at).getTime() < now.getTime()

  return (
    row.mollie_status === 'rejected' ||
    row.mollie_status === 'needs_action' ||
    (row.mollie_status === 'verified' && (row.mollie_access_token === null || tokenExpired))
  )
}

export function maskOrganizationId(id: string | null): string | null {
  if (!id) return null
  const underscore = id.indexOf('_')
  const prefix = underscore >= 0 ? id.slice(0, underscore + 1) : ''
  const rest = id.slice(prefix.length)
  if (rest.length <= 4) return `${prefix}••••`
  return `${prefix}••••${rest.slice(-4)}`
}

type LiveCheckResult = 'ok' | 'auth_failed' | 'unreachable'

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('mollie_live_check_timeout')), ms)
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

/**
 * One cheap authenticated call (current organization) using a valid token,
 * refreshed if needed. Auth problems (refresh rejected, 401/403) → expired;
 * timeouts, network errors and 5xx → unreachable (don't blame the owner).
 */
async function liveCheck(admin: SupabaseClient, restaurantId: string): Promise<LiveCheckResult> {
  try {
    await withTimeout(
      (async () => {
        const token = await getValidAccessTokenForRestaurant(admin, restaurantId)
        await getMollieOAuthClient(token).organizations.getCurrent()
      })(),
      LIVE_CHECK_TIMEOUT_MS,
    )
    return 'ok'
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const statusCode = (err as { statusCode?: number } | null)?.statusCode

    if (message.startsWith('restaurant_missing_mollie_tokens')) return 'auth_failed'
    const refreshFail = /^mollie_token_refresh_failed:(\d{3})/.exec(message)
    if (refreshFail) {
      const code = Number(refreshFail[1])
      return code >= 400 && code < 500 ? 'auth_failed' : 'unreachable'
    }
    if (statusCode === 401 || statusCode === 403) return 'auth_failed'
    return 'unreachable'
  }
}

/**
 * For restaurants mid-KYC (pending / needs_action) ask Mollie for the current
 * onboarding status and persist a change — the same sync the onboarding poller
 * does, so a finished reconnect flips to 'verified' without waiting for the
 * webhook. Best effort: any failure keeps the stored status.
 */
async function syncOnboardingStatus(
  admin: SupabaseClient,
  restaurantId: string,
  current: string,
): Promise<string> {
  try {
    const mapped = await withTimeout(
      (async () => {
        const token = await getValidAccessTokenForRestaurant(admin, restaurantId)
        return mapOnboardingStatus(await fetchOnboardingStatus(token))
      })(),
      LIVE_CHECK_TIMEOUT_MS,
    )
    if (mapped === current) return current
    await admin
      .from('restaurants')
      .update({
        mollie_status: mapped,
        ...(mapped === 'verified' ? { mollie_verified_at: new Date().toISOString() } : {}),
      })
      .eq('id', restaurantId)
    return mapped
  } catch {
    return current
  }
}

export async function resolveMollieConnection(
  admin: SupabaseClient,
  restaurantId: string,
  row: MollieConnectionRow,
): Promise<MollieConnectionInfo> {
  const base = {
    organizationIdMasked: maskOrganizationId(row.mollie_organization_id),
    verifiedAt: row.mollie_verified_at,
    liveAuthFailed: false,
  }

  let status = row.mollie_status ?? 'not_started'

  if (row.mollie_organization_id && (status === 'pending' || status === 'needs_action')) {
    const synced = await syncOnboardingStatus(admin, restaurantId, status)
    if (synced === 'verified') {
      status = 'verified'
      row = { ...row, mollie_status: 'verified', mollie_verified_at: new Date().toISOString() }
      base.verifiedAt = row.mollie_verified_at
    } else {
      status = synced
    }
  }

  // Never connected, or an OAuth handshake that was started and never finished.
  if (status === 'not_started' || (!row.mollie_organization_id && status === 'pending')) {
    return { ...base, state: 'not_connected', liveCheckUnavailable: false }
  }

  if (status === 'pending' || status === 'needs_action' || status === 'rejected') {
    return { ...base, state: 'action_needed', liveCheckUnavailable: false }
  }

  // 'verified' but the organization or tokens are gone: it worked once and
  // can't now — same definition as the Today alert (isMollieBrokenRow).
  if (!row.mollie_organization_id || !row.mollie_access_token) {
    return { ...base, state: 'expired', liveCheckUnavailable: false }
  }

  // status === 'verified' (or an unknown future value, treated the same)
  const live = await liveCheck(admin, restaurantId)
  if (live === 'ok') return { ...base, state: 'connected', liveCheckUnavailable: false }
  if (live === 'auth_failed') {
    return { ...base, state: 'expired', liveCheckUnavailable: false, liveAuthFailed: true }
  }

  // Mollie unreachable: fall back to what we have stored.
  const brokenByStored = isMollieBrokenRow(row, new Date())
  return {
    ...base,
    state: brokenByStored ? 'expired' : 'connected',
    liveCheckUnavailable: true,
  }
}
