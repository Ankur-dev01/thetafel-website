import { defineConfig, devices } from '@playwright/test'

// Playwright's own process doesn't get .env.local for free the way `next dev`
// does — load it so tests can reach the Supabase admin client via the same
// env vars the app uses.
try {
  process.loadEnvFile('.env.local')
} catch {
  // fine in CI where env vars are injected directly and .env.local doesn't exist
}

const PORT = Number(process.env.PLAYWRIGHT_PORT ?? 3000)
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  fullyParallel: false, // shared DB state (single Supabase project, no dev/test split) — keep serial for now
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    locale: 'nl-NL',
    timezoneId: 'Europe/Amsterdam',
  },

  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
})
