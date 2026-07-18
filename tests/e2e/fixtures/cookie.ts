import type { Page } from '@playwright/test'

/**
 * Dismisses the cookie consent dialog by clicking "Alles accepteren"
 * (or its EN equivalent "Accept all"). No-op if the banner isn't showing.
 * Consent state lives in localStorage under key `tafel-consent-v1` (see lib/consent.ts).
 */
export async function acceptAllCookies(page: Page): Promise<void> {
  const acceptAllNl = page.getByRole('button', { name: 'Alles accepteren' })
  const acceptAllEn = page.getByRole('button', { name: 'Accept all' })

  const nlVisible = await acceptAllNl.isVisible().catch(() => false)
  const enVisible = await acceptAllEn.isVisible().catch(() => false)

  if (nlVisible) {
    await acceptAllNl.click()
  } else if (enVisible) {
    await acceptAllEn.click()
  }
}

/**
 * Presets consent in localStorage BEFORE first navigation so the banner
 * never renders. Shape must match StoredConsent in lib/consent.ts exactly —
 * readConsent() rejects anything with a different version or a stale
 * timestamp (> 365 days), and the banner shows again if that happens.
 */
export async function presetConsent(
  page: Page,
  categories: { essential: true; analytics: boolean; marketing: false } = {
    essential: true,
    analytics: false,
    marketing: false,
  },
): Promise<void> {
  await page.addInitScript((categories) => {
    const consent = {
      version: 1,
      timestamp: Date.now(),
      categories,
    }
    window.localStorage.setItem('tafel-consent-v1', JSON.stringify(consent))
  }, categories)
}
