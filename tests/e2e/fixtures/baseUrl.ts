/** Same resolution as playwright.config.ts (PLAYWRIGHT_BASE_URL, else the dev server port). */
export function playwrightBaseUrl(): string {
  const port = Number(process.env.PLAYWRIGHT_PORT ?? 3000)
  return process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`
}
