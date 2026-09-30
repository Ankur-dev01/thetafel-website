import { createHash, randomBytes } from 'node:crypto'
import type { APIRequestContext, Page } from '@playwright/test'
import { adminClient, TEST_RESTAURANT_ID } from './test-restaurant'

/**
 * Persistent test staff accounts on `_e2e_test_restaurant` (BATCH-4 D8.4).
 *
 *   E2E_MANAGER_EMAIL / E2E_MANAGER_PASSWORD
 *   E2E_SERVICE_EMAIL / E2E_SERVICE_PASSWORD
 *   E2E_KITCHEN_EMAIL / E2E_KITCHEN_PASSWORD
 *
 * live in .env.local (gitignored). `node scripts/e2e-generate-role-passwords.mjs`
 * creates them. The first run provisions each account through the REAL invite
 * flow (an invite row with a token we hash ourselves, accepted via
 * POST /api/staff/accept); later runs just re-assert role / active / password.
 */

export type TestRole = 'manager' | 'service' | 'kitchen'
export const TEST_ROLES: TestRole[] = ['manager', 'service', 'kitchen']

export function roleCredentials(role: TestRole): { email: string; password: string } {
  const key = role.toUpperCase()
  const email = process.env[`E2E_${key}_EMAIL`]
  const password = process.env[`E2E_${key}_PASSWORD`]
  if (!email || !password) {
    throw new Error(
      `[role-accounts] missing E2E_${key}_EMAIL / E2E_${key}_PASSWORD — run ` +
        '`node scripts/e2e-generate-role-passwords.mjs` (see tests/e2e/README.md).',
    )
  }
  return { email, password }
}

async function ownerStaffId(): Promise<string> {
  const { data } = await adminClient()
    .from('restaurant_staff')
    .select('id')
    .eq('restaurant_id', TEST_RESTAURANT_ID)
    .eq('role', 'owner')
    .is('deactivated_at', null)
    .maybeSingle()
  if (!data) throw new Error('[role-accounts] no active owner staff row on the test restaurant')
  return data.id as string
}

export async function ensureRoleAccounts(request: APIRequestContext): Promise<void> {
  const admin = adminClient()
  for (const role of TEST_ROLES) {
    const { email, password } = roleCredentials(role)
    const { data: profile } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()

    if (profile?.id) {
      // Account exists: re-assert password, role and active membership.
      const { error } = await admin.auth.admin.updateUserById(profile.id as string, { password })
      if (error) throw new Error(`[role-accounts] password stamp failed for ${role}: ${error.message}`)
      const { data: row } = await admin
        .from('restaurant_staff')
        .select('id')
        .eq('restaurant_id', TEST_RESTAURANT_ID)
        .eq('user_id', profile.id as string)
        .maybeSingle()
      if (row) {
        await admin.from('restaurant_staff').update({ role, deactivated_at: null }).eq('id', row.id as string)
        continue
      }
    }

    // New account (or an orphaned user with no membership): real invite flow.
    const token = randomBytes(32).toString('base64url')
    const invite = {
      role,
      token_hash: createHash('sha256').update(token).digest('hex'),
      invited_by: await ownerStaffId(),
      expires_at: new Date(Date.now() + 3600_000).toISOString(),
      created_at: new Date().toISOString(),
      accepted_at: null,
      revoked_at: null,
    }
    const { error } = await admin
      .from('staff_invites')
      .upsert({ restaurant_id: TEST_RESTAURANT_ID, email_lower: email.toLowerCase(), ...invite }, { onConflict: 'restaurant_id,email_lower' })
    if (error) throw new Error(`[role-accounts] invite insert failed for ${role}: ${error.message}`)

    const res = await request.post('/api/staff/accept', {
      data: { token, name: `E2E ${role}`, password, locale: 'nl' },
    })
    if (!res.ok()) throw new Error(`[role-accounts] accept failed for ${role}: ${res.status()} ${await res.text()}`)
  }
}

export async function signInAs(page: Page, role: TestRole): Promise<void> {
  const { email, password } = roleCredentials(role)
  const res = await page.request.post('/api/auth/login', { data: { email, password } })
  if (!res.ok()) throw new Error(`[signInAs ${role}] login failed: ${res.status()} ${await res.text()}`)
}

export async function setRoleActive(role: TestRole, active: boolean): Promise<void> {
  const { email } = roleCredentials(role)
  const admin = adminClient()
  const { data: profile } = await admin.from('profiles').select('id').eq('email', email).maybeSingle()
  if (!profile?.id) throw new Error(`[setRoleActive] no account for ${role}`)
  const { error } = await admin
    .from('restaurant_staff')
    .update({ deactivated_at: active ? null : new Date().toISOString() })
    .eq('restaurant_id', TEST_RESTAURANT_ID)
    .eq('user_id', profile.id as string)
  if (error) throw new Error(`[setRoleActive] ${error.message}`)
}
