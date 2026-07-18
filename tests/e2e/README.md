# End-to-end tests (Playwright)

## Before you run anything

There is currently **no separate dev/staging Supabase project**. `NEXT_PUBLIC_SUPABASE_PROD_URL`
is the same project the deployed app uses. Any test that writes to the database (via
`tests/e2e/fixtures/test-restaurant.ts`) writes to that project. Isolation depends entirely on:

- tagging every guest a test creates with the email from `testGuestEmail(testRunId)`
- calling `cleanupTestRun(testRunId)` afterwards

Not on a sandboxed database — there isn't one. Be careful with anything beyond the smoke test.

## Run locally

Prerequisites: `NEXT_PUBLIC_SUPABASE_PROD_URL` and `SUPABASE_PROD_SERVICE_ROLE_KEY` in `.env.local`
(only needed once tests use `test-restaurant.ts`; the smoke test doesn't touch the DB).

```
npm run test:e2e
```

Starts the local dev server on port 3000 automatically if one isn't already running
(`reuseExistingServer` is on outside CI).

To run a single test file:

```
npx playwright test tests/e2e/smoke/home.spec.ts
```

To open the HTML report after a run:

```
npx playwright show-report
```

## Writing new tests

- Import `test` and `expect` from `tests/e2e/fixtures/base.ts`, NOT from `@playwright/test` directly
  — that's what presets cookie consent and hands you a fresh `testRunId`.
- If a test writes to the DB, tag the guest with `testGuestEmail(testRunId)` and call
  `cleanupTestRun(testRunId)` in `test.afterEach`.
- Never point `PLAYWRIGHT_BASE_URL` at the real deployed site.
