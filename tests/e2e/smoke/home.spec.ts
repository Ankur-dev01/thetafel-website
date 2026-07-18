import { test, expect } from '../fixtures/base'
import { switchToEnglish } from '../fixtures/locale'

test.describe('marketing home smoke', () => {
  test('Dutch home renders and locale toggles to English', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByText('TAFEL', { exact: true }).first()).toBeVisible()

    // Cookie banner must not be visible (consent preset in the base fixture)
    await expect(page.getByRole('dialog', { name: /cookies/i })).toHaveCount(0)

    await switchToEnglish(page)
    await expect(page).toHaveURL(/\/en(\/|$)/)
    await expect(page.getByText('TAFEL', { exact: true }).first()).toBeVisible()
  })
})
