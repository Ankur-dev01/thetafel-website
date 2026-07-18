import type { Page } from '@playwright/test'

// The locale toggle (components/layout/Nav.tsx) is a <button> labelled
// "EN"/"NL" that calls router.push — not a link — so it must be located
// by role "button", not "link".

export async function switchToEnglish(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'EN', exact: true }).first().click()
  await page.waitForURL(/\/en(\/|$)/)
}

export async function switchToDutch(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'NL', exact: true }).first().click()
  await page.waitForURL((url) => !url.pathname.startsWith('/en'))
}
