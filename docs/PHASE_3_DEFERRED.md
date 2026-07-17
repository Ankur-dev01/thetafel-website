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

## 2. Missing `assertConsumerWriteAllowed` calls

`start-deposit` and `bookings/create` do not call the mutation doorman
(`assertConsumerWriteAllowed`), unlike `order`, `takeaway-order`, `cancel`,
and `change-request`. Confirm during C9.2 whether this is intentional
(deposit/booking creation allowed to proceed even under lockdown) or a bug.

## 3. No per-(email, phone) rate limiter

`lib/consumer/rateLimit.ts` only rate-limits by IP. There is no limiter keyed
on guest email or phone, despite at least one prior design doc assuming one
exists on the booking route. Add a helper and apply it to `book` and `order`
routes in C9.2.
