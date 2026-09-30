import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { generateMagicLinkToken, hashMagicLinkToken } from '@/lib/consumer/magicLinks'
import type { StaffRole } from '@/lib/dashboard/nav'

/**
 * Staff invite lifecycle (PRD §2.2). Tokens are random, stored only as a
 * SHA-256 hash (same scheme as consumer magic links), expire after 7 days, and
 * are single-use. staff_invites is UNIQUE (restaurant_id, email_lower), so a
 * re-invite REPLACES the existing row (new token hash, fresh expiry, revoked /
 * accepted flags cleared) — which also invalidates the old link.
 */

export const INVITE_TTL_DAYS = 7
export const INVITES_PER_DAY_PER_RESTAURANT = 20

type Admin = SupabaseClient

export type InviteRow = {
  id: string
  restaurant_id: string
  email_lower: string
  role: Exclude<StaffRole, 'owner'>
  token_hash: string
  invited_by: string
  expires_at: string
  accepted_at: string | null
  revoked_at: string | null
  created_at: string
}

export type InviteStatus = 'valid' | 'expired' | 'accepted' | 'revoked'

export function inviteStatus(row: Pick<InviteRow, 'expires_at' | 'accepted_at' | 'revoked_at'>, now: Date = new Date()): InviteStatus {
  if (row.accepted_at) return 'accepted'
  if (row.revoked_at) return 'revoked'
  if (new Date(row.expires_at).getTime() <= now.getTime()) return 'expired'
  return 'valid'
}

export function normaliseEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const v = raw.trim().toLowerCase()
  return v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : null
}

/** Auth user id for an email, via profiles (email is citext, unique). */
export async function findUserIdByEmail(admin: Admin, email: string): Promise<string | null> {
  const { data } = await admin.from('profiles').select('id').eq('email', email).maybeSingle<{ id: string }>()
  return data?.id ?? null
}

export type CreateInviteResult =
  | { ok: true; token: string; inviteId: string; replaced: boolean }
  | { ok: false; code: 'rate_limited' | 'already_member' | 'db_error' }

export async function createOrRefreshInvite(args: {
  admin: Admin
  restaurantId: string
  email: string
  role: Exclude<StaffRole, 'owner'>
  invitedByStaffId: string
  now?: Date
}): Promise<CreateInviteResult> {
  const { admin, restaurantId, email, role } = args
  const now = args.now ?? new Date()

  const since = new Date(now.getTime() - 24 * 3600_000).toISOString()
  const { count } = await admin
    .from('staff_invites')
    .select('id', { count: 'exact', head: true })
    .eq('restaurant_id', restaurantId)
    .gte('created_at', since)
  if ((count ?? 0) >= INVITES_PER_DAY_PER_RESTAURANT) return { ok: false, code: 'rate_limited' }

  const existingUserId = await findUserIdByEmail(admin, email)
  if (existingUserId) {
    const { data: member } = await admin
      .from('restaurant_staff')
      .select('id')
      .eq('restaurant_id', restaurantId)
      .eq('user_id', existingUserId)
      .is('deactivated_at', null)
      .maybeSingle()
    if (member) return { ok: false, code: 'already_member' }
  }

  const token = generateMagicLinkToken()
  const fields = {
    role,
    token_hash: hashMagicLinkToken(token),
    invited_by: args.invitedByStaffId,
    expires_at: new Date(now.getTime() + INVITE_TTL_DAYS * 24 * 3600_000).toISOString(),
    created_at: now.toISOString(),
    accepted_at: null,
    revoked_at: null,
  }

  const { data: existing } = await admin
    .from('staff_invites')
    .select('id')
    .eq('restaurant_id', restaurantId)
    .eq('email_lower', email)
    .maybeSingle<{ id: string }>()

  if (existing) {
    const { error } = await admin.from('staff_invites').update(fields).eq('id', existing.id).eq('restaurant_id', restaurantId)
    if (error) return { ok: false, code: 'db_error' }
    return { ok: true, token, inviteId: existing.id, replaced: true }
  }

  const { data: inserted, error } = await admin
    .from('staff_invites')
    .insert({ restaurant_id: restaurantId, email_lower: email, ...fields })
    .select('id')
    .single<{ id: string }>()
  if (error || !inserted) return { ok: false, code: 'db_error' }
  return { ok: true, token, inviteId: inserted.id, replaced: false }
}

export async function findInviteByToken(admin: Admin, token: string): Promise<InviteRow | null> {
  if (!token || token.length < 20 || token.length > 200) return null
  const { data } = await admin
    .from('staff_invites')
    .select('id, restaurant_id, email_lower, role, token_hash, invited_by, expires_at, accepted_at, revoked_at, created_at')
    .eq('token_hash', hashMagicLinkToken(token))
    .maybeSingle<InviteRow>()
  return data ?? null
}
