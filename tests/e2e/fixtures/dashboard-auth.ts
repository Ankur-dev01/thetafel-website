import type { Page } from '@playwright/test'
import { adminClient, TEST_RESTAURANT_OWNER_ID } from './test-restaurant'

/**
 * The e2e owner fixture has no password of its own (it was created via the Auth
 * admin API). Credentials come from the environment — never from source:
 *
 *   E2E_DASHBOARD_EMAIL     login email of the `_e2e_test_restaurant` owner
 *   E2E_DASHBOARD_PASSWORD  the password to (re)stamp on that user
 *
 * Put both in .env.local (gitignored; playwright.config.ts loads it). Each run
 * stamps the password via the admin client, then drives the app's own
 * /api/auth/login route from the page's request context so the resulting
 * session cookies land in the same browser context as `page`.
 */
function readE2eCredentials(): { email: string; password: string } {
  const email = process.env.E2E_DASHBOARD_EMAIL
  const password = process.env.E2E_DASHBOARD_PASSWORD
  const missing = [
    !email && 'E2E_DASHBOARD_EMAIL',
    !password && 'E2E_DASHBOARD_PASSWORD',
  ].filter(Boolean)
  if (!email || !password) {
    throw new Error(
      `[signInAsTestOwner] missing env var(s): ${missing.join(', ')}. ` +
        'Add them to .env.local (see tests/e2e/README.md).',
    )
  }
  return { email, password }
}

export async function signInAsTestOwner(page: Page): Promise<void> {
  const { email, password } = readE2eCredentials()

  const admin = adminClient()
  const { error } = await admin.auth.admin.updateUserById(TEST_RESTAURANT_OWNER_ID, {
    password,
  })
  if (error) {
    throw new Error(`[signInAsTestOwner] failed to set test owner password: ${error.message}`)
  }

  const res = await page.request.post('/api/auth/login', {
    data: { email, password },
  })
  if (!res.ok()) {
    throw new Error(`[signInAsTestOwner] login failed: ${res.status()} ${await res.text()}`)
  }
}
