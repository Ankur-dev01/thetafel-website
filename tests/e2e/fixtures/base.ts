import { test as base, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { presetConsent } from './cookie'
import { wipeTestRestaurant } from './test-restaurant'

// Safety net — if a previous run crashed mid-test, garbage stays scoped to
// the dedicated test restaurant (see test-restaurant.ts). Wipe it clean
// before the suite starts so a crashed run never poisons the next one.
base.beforeAll(async () => {
  await wipeTestRestaurant()
})

export const test = base.extend<{
  testRunId: string
}>({
  testRunId: async ({}, use) => {
    await use(randomUUID())
  },
  page: async ({ page }, use) => {
    await presetConsent(page)
    await use(page)
  },
})

export { expect }
