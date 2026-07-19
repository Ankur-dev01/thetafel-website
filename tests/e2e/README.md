# End-to-end tests (Playwright)

## Test isolation

There is currently **no separate dev/staging Supabase project** — `NEXT_PUBLIC_SUPABASE_PROD_URL`
is the same project the deployed app uses. Every write a test makes is scoped to one dedicated
restaurant instead:

- `_e2e_test_restaurant` (id, zone id, table id, qr token all in
  `tests/e2e/fixtures/test-restaurant.ts`), seeded with one zone, one table, opening hours for
  every day, and a 3-category/6-item menu.
- Slug is prefixed with `_` so no discovery/marketplace surface ever routes to it.
- Marked `status='live'` with all three service flags on, so the mutation doorman
  (`assertConsumerWriteAllowed` / `loadBookingConfig`) accepts writes against it.
- Guests created by tests use the email from `testGuestEmail(testRunId)`
  (`e2e-<uuid>@e2e.thetafel.invalid`) so they're recognisable at a glance.

At the start of every test run, `base.ts`'s `beforeAll` hook calls `wipeTestRestaurant()`, which
deletes every booking/order/tab/audit-log/payment-intent/magic-link scoped to
`_e2e_test_restaurant` and anonymises any `e2e-*@e2e.thetafel.invalid` guest rows. This is the
safety net if a previous run crashed mid-test — cleanup is nuclear (everything scoped to that one
restaurant_id), not incremental per test.

**Do not** hardcode or reference `_e2e_test_restaurant` from application code — it is a test
fixture only. Never point `PLAYWRIGHT_BASE_URL` at the real deployed site.

## Run locally

Prerequisites: `NEXT_PUBLIC_SUPABASE_PROD_URL` and `SUPABASE_PROD_SERVICE_ROLE_KEY` in `.env.local`.
The `beforeAll` wipe hook runs on every suite, so these are needed even for tests that don't touch
the DB themselves.

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
  — that's what presets cookie consent, hands you a fresh `testRunId`, and runs the restaurant wipe.
- Any booking/order/table write must target `TEST_RESTAURANT_ID` / `TEST_RESTAURANT_SLUG` /
  `TEST_RESTAURANT_TABLE_QR_TOKEN` from `test-restaurant.ts`. Never write against a real restaurant.
- Tag any guest a test creates with `testGuestEmail(testRunId)` so it's obviously test data and gets
  swept up by `wipeTestRestaurant()` on the next run.
