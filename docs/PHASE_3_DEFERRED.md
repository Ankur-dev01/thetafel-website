# Phase 3 Deferred Items

Items discovered during C9.1 that are real gaps but out of scope for Phase 2
hardening. Tracked here so they aren't lost; not to be fixed opportunistically.

## 1. Full deposit → booking linkage

`bookings.deposit_intent_id` exists as a schema column (with FK to
`payment_intents`) but is unused in application code today:

- The booking-creation flow (`app/api/consumer/bookings/create/route.ts` →
  `lib/booking/createBooking.ts`) has no field for a deposit reference and
  never sets `deposit_intent_id` on insert.
- The frontend booking flow does not call `start-deposit` anywhere.
- The consumer Mollie webhook
  (`app/api/webhooks/mollie/consumer/route.ts`) treats
  `purpose === 'deposit'` as an explicit no-op — see the TODO at the top of
  that file.
- No helper resolves a `bookings` row to its refundable Mollie payment
  (`lib/mollie/refundConnectedPayment.ts` is a bare Mollie-call wrapper with
  no lookup logic).

Full unit needs: `depositIntentId` accepted by `createBookingInputSchema` and
validated/written in `createBooking.ts` (including the `payment_intents.metadata`
backfill with `booking_id`/`booking_ref`), the frontend flow wired at the
review/confirm step, a webhook branch that marks deposits paid, and a
`resolveDepositForBooking` helper for refunds.

## 2. Missing `assertConsumerWriteAllowed` calls — RESOLVED in C9.2b

`start-deposit` and `bookings/create` now both call
`assertConsumerWriteAllowed` (actions `booking.create_deposit` and
`booking.create`). Note: both routes already independently rejected writes
for `restaurants.status !== 'live'` / `!service_reservations_enabled` via
`loadBookingConfig` before this change — the doorman call is defense in
depth / convention consistency, not a fix for a previously-exploitable hole.

**Still open:** neither `assertConsumerWriteAllowed` nor `loadBookingConfig`
reads billing/subscription health. Restaurant payment failure state lives on
the separate `subscriptions` table (`subscriptions.status`, values
`trialing | active | past_due | suspended | cancelled` — see
`packages/db/types.ts`), not on `restaurants.status`. A restaurant whose
subscription lapses into `past_due`/`suspended` but whose `restaurants.status`
is still `'live'` can currently still take deposits and bookings. Needs a
decision on whether the doorman should join `subscriptions` before Phase 3,
and what "restaurant billing suspended" should mean for an in-progress guest
booking.

## 3. No per-(email, phone) rate limiter — RESOLVED in C9.2b

`checkEmailPhoneRateLimit(email, phone, scope)` added to
`lib/consumer/rateLimit.ts`, applied to `start-deposit`, `bookings/create`
(scope `'booking'`, 3/hour) and `takeaway-order` (scope `'order'`, 5/hour).

**Not applied:** the QR order route (`app/api/v1/public/[slug]/order/route.ts`)
collects no guest email or phone at all — QR ordering is anonymous,
table-scoped. There is no (email, phone) tuple to key a limiter on there; it
relies on IP + per-(slug,tableId) rate limiting only.

## 4. Duplicate `qr_item_notes_allowed` column

The `restaurants` table has two columns for the same setting:
`qr_item_notes_allowed` (Phase 1, still read+written by
`app/[locale]/onboarding/qr-setup/page.tsx` and validated in
`lib/onboarding/draftSchema.ts`) and `qr_item_notes_enabled` (Phase 2, used
by consumer code). Column drop deferred until onboarding is migrated to
read/write `qr_item_notes_enabled`. Two-step: (a) update onboarding, (b) drop
old column.

## 5. No `metadata` JSONB column on `guests` / `bookings` / `orders`

Discovered during C9.3a (Playwright test infrastructure). The original brief
assumed a `metadata` JSONB column on these tables for tagging/cleaning up
e2e-test-created rows (`metadata->>test_run_id`). No such column exists on
any of the three tables in the applied schema
(`TheTafel_Consumer_Schema_v1_0.sql`) — only `consumer_audit_logs.event_data`
is JSONB.

Worked around for now in `tests/e2e/fixtures/test-restaurant.ts` by tagging
test rows via a distinctive guest email
(`e2e-<testRunId>@e2e.thetafel.invalid`) and cascading cleanup from the
guest row to its bookings/orders/audit-log rows. This is adequate for
Phase 2 test isolation but is a workaround, not a real fix — if test suites
grow and need to tag rows that aren't reachable from a guest (e.g.
restaurant-level fixtures, menu items), a real `metadata` column (or a
dedicated `test_run_id` column with a partial index) would be worth adding.
Do not add it opportunistically; scope it as its own migration.
