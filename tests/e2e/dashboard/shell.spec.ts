import { test, expect } from '../fixtures/base'
import { wipeTestRestaurant } from '../fixtures/test-restaurant'
import { signInAsTestOwner } from '../fixtures/dashboard-auth'

test.describe('Dashboard shell (D0.4 smoke)', () => {
  test.afterEach(async () => {
    await wipeTestRestaurant()
  })

  test('anonymous visitor is bounced to login with next preserved', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/)
  })

  test('signed-in owner sees the shell, phone tab bar, and the Vandaag page', async ({ page }) => {
    await signInAsTestOwner(page)

    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/dashboard$/)

    // Sidebar wordmark (desktop viewport per playwright.config.ts default).
    await expect(page.getByText('Tafel', { exact: false }).first()).toBeVisible()

    // Vandaag content (D1.1 real page, not the D0.2 placeholder anymore).
    await expect(page.getByRole('heading', { name: 'Nu en straks' })).toBeVisible()

    // Phone tab bar at 375px — scoped to the bottom nav so it doesn't match
    // the StatTile links on the page itself (which also link to /dashboard/bookings etc).
    await page.setViewportSize({ width: 375, height: 800 })
    const tabBar = page.getByRole('navigation', { name: 'Hoofdnavigatie' })
    await expect(tabBar.getByRole('link', { name: 'Vandaag', exact: true })).toBeVisible()
    await expect(tabBar.getByRole('link', { name: 'Reserveringen', exact: true })).toBeVisible()
    await expect(tabBar.getByRole('link', { name: 'Bestellingen', exact: true })).toBeVisible()
  })
})
