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

  test('signed-in owner sees the shell, phone tab bar, and Vandaag placeholder', async ({ page }) => {
    await signInAsTestOwner(page)

    await page.goto('/dashboard')
    await expect(page).toHaveURL(/\/dashboard$/)

    // Sidebar wordmark (desktop viewport per playwright.config.ts default).
    await expect(page.getByText('Tafel', { exact: false }).first()).toBeVisible()

    // Vandaag placeholder heading.
    await expect(page.getByRole('heading', { name: 'Vandaag' })).toBeVisible()

    // Phone tab bar at 375px.
    await page.setViewportSize({ width: 375, height: 800 })
    await expect(page.getByRole('link', { name: /Vandaag/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Reserveringen/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /Bestellingen/i })).toBeVisible()
  })
})
