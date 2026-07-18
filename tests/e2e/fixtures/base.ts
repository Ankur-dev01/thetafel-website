import { test as base, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { presetConsent } from './cookie'

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
