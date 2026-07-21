import type { Page } from '@playwright/test'
import { adminClient, TEST_RESTAURANT_OWNER_ID, TEST_RESTAURANT_OWNER_EMAIL } from './test-restaurant'

/**
 * No password infra exists for the e2e owner fixture (it was created via the
 * Auth admin API, not signup, so it has no password set by default). Stamp
 * a fixed known password via the admin client, then drive the app's own
 * /api/auth/login route from the page's request context so the resulting
 * session cookies land in the same browser context as `page`.
 */
const TEST_OWNER_PASSWORD = 'E2E-dashboard-owner-pw-9f3a7c'

export async function signInAsTestOwner(page: Page): Promise<void> {
  const admin = adminClient()
  const { error } = await admin.auth.admin.updateUserById(TEST_RESTAURANT_OWNER_ID, {
    password: TEST_OWNER_PASSWORD,
  })
  if (error) {
    throw new Error(`[signInAsTestOwner] failed to set test owner password: ${error.message}`)
  }

  const res = await page.request.post('/api/auth/login', {
    data: { email: TEST_RESTAURANT_OWNER_EMAIL, password: TEST_OWNER_PASSWORD },
  })
  if (!res.ok()) {
    throw new Error(`[signInAsTestOwner] login failed: ${res.status()} ${await res.text()}`)
  }
}
