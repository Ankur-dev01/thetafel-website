# The Tafel — Build Plan
## Part 2 of 3 — Consumer-Facing Surfaces

**Document:** TheTafel_Consumer_BuildPlan_v1.0
**Companion to:** TheTafel_Consumer_PRD_v1.0.md (the spec) and TheTafel_Consumer_Schema_v1.0.sql (the schema).
**Purpose:** Sequencing the Phase 2 work into atomic prompt files for Claude Code, with no ambiguity about order, dependencies, files touched, or verification.

---

## 0. How to use this document

### 0.1 What this document is

This is the **map** from the PRD to actual buildable units. For each unit, you'll find:

- **Purpose** — one sentence on why this step exists.
- **PRD section** — which PRD section governs this unit (so the implementer can always go back to the spec).
- **Files touched** — every file the prompt will create or modify.
- **MCP operations** — Supabase / Vercel MCP calls Claude in chat must run before or after (schema applies, log inspections, state verifications).
- **Combines with** — when two PRD steps share one prompt file because they share a file or a concern.
- **Verification** — what Ankur must check in the browser/MCP before approving the unit.
- **Stop signal** — the exact phrase or evidence that lets us declare the unit done and move on.

### 0.2 Order rules

Phases are sequential. A later phase reads from tables a previous phase creates. Within a phase, sub-steps can occasionally parallelise but the document assumes serial execution — the user will likely want to confirm one thing at a time.

Skipping or "doing later" is **not allowed**. If a step is genuinely blocked (e.g. waiting on Meta WhatsApp verification), the build plan still names the blocker, the workaround, and what to ship in the meantime.

### 0.3 Naming convention

- Phase letters: **C0, C1, ... C9** (C for Consumer).
- Sub-steps: **C0.1, C0.2, ...**
- Prompt files saved as `/home/claude/prompts/C{phase}_{slug}.md` (example: `C4_1_availability_engine.md`).
- Commits use Conventional Commits with the phase prefix: `feat(consumer/C4.1): availability engine`.

### 0.4 Working rhythm reminder

Per PRD §0.3 and §15:

- One prompt per logical unit. Wait for the user to confirm before moving on.
- Read the relevant code before proposing any fix. No guessing.
- Push to `git push origin main` after every successful unit; verify with `git log --oneline -3`.
- Plain English, no fluff, no buzzwords.
- Security checklist (§8 of PRD) applied to every public endpoint without exception.

---

## 1. Phase overview

| Phase | Focus | Prompt count | Dependencies |
|---|---|---|---|
| C0 | Foundation — public routing, layout, restaurant header | 4 | None (uses Phase 1 onboarding output) |
| C1 | Schema additions — all new tables, columns, RLS | 2 | None (Supabase MCP) |
| C2 | Security primitives — rate limit, captcha, audit, guards, magic links | 4 | C1 |
| C3 | Notifications infrastructure — Resend, WhatsApp | 3 | C2 |
| C4 | Reservation flow — full R0 → R7 | 8 | C0, C1, C2, C3 |
| C5 | QR ordering flow — full Q0 → Q5 | 6 | C0, C1, C2, C3 |
| C6 | Takeaway flow — full T0 → T6 (composed) | 4 | C5 (heavy reuse) |
| C7 | Thin-slice "Today" view for restaurants — read-only ops surface | 3 | C4, C5, C6 |
| C8 | GDPR — cookie banner, privacy page, data tools | 3 | C2 |
| C9 | Hardening — security review, performance, end-to-end smoke | 4 | All previous |

**Total:** 41 prompt files across Phase 2.

---

# Phase C0 — Foundation

PRD references: §2.1 routing, §2.2 caching, §2.5 multi-language, §2.6 mobile-first, §4 R0/§6 T0 restaurant header.

The goal of C0 is to stand up the public surface area without any flows yet — just the routing, the layout, the header, and the 404. After C0 the user can visit `/r/karan-gupta/` and see the restaurant header but no booking form. Everything else builds on this skeleton.

## C0.1 — Public route structure and slug resolver

**Purpose.** Establish `/r/[slug]/` as the consumer-facing route prefix and the slug-to-restaurant resolver.

**PRD section.** §2.1, §2.2.

**Files touched.**
- `app/[locale]/r/[slug]/layout.tsx` (new — consumer layout shell)
- `app/[locale]/r/[slug]/page.tsx` (new — restaurant home with brief overview, redirects to /book if reservations enabled, else /order, else /qr if scanned without table)
- `app/[locale]/r/[slug]/not-found.tsx` (new — branded 404)
- `lib/consumer/resolveRestaurant.ts` (new — slug → restaurant row, cached)
- `proxy.ts` (minor — ensure middleware doesn't strip `/r/` segments)

**MCP operations.** None (data already in `restaurants`).

**Combines with.** Includes the not-found page in the same prompt because it shares the layout chrome and slug logic.

**Verification.**
- Visit `thetafel.nl/r/karan-gupta/` (Karan's slug from Phase 1 test data) — page loads, shows the layout shell.
- Visit `thetafel.nl/r/does-not-exist/` — 404 with branded chrome, NL by default, EN at `/en/r/does-not-exist/`.
- Visit `thetafel.nl/r/karan-gupta/book` — page loads (empty placeholder for now), proving the nested route works.

**Stop signal.** Ankur confirms 404 renders cleanly and the slug page loads for the test restaurant.

---

## C0.2 — Public restaurant header component

**Purpose.** The shared header rendered at the top of every consumer page (R0, T0, Q0 all use this).

**PRD section.** §4 Step R0, §6 Step T0.

**Files touched.**
- `components/consumer/RestaurantHeader.tsx` (new)
- `components/consumer/RestaurantHeaderClient.tsx` (new — only if needed for client-side bits like a map link)
- `lib/consumer/formatHours.ts` (new — today's hours summary)
- `messages/nl.json` + `messages/en.json` (new keys under `consumer.header`)

**MCP operations.** Verify required columns on `restaurants`: `display_name`, `cuisine_type`, `neighbourhood`, `address_line1`, `address_postcode`, `address_city`, `phone_public`, `photo_url`, opening hours rows. If any are missing in live DB, add as part of C1.

**Combines with.** Stand-alone — the header is reused everywhere but built once.

**Verification.**
- Header shows the restaurant photo (or amber wordmark fallback if no photo).
- Name in Raleway 900 at 36–48px responsive.
- Today's hours render in plain Dutch ("Open van 17:00 – 23:00" / "Gesloten vandaag").
- Address is clickable, opens Google Maps in a new tab.
- Phone is `tel:` linked on mobile (test via DevTools mobile emulation).
- NL/EN language toggle in the corner works without page reload (per Phase 1 Polish #20 pattern).

**Stop signal.** Header visually matches the PRD R0 spec on desktop, tablet, mobile.

---

## C0.3 — ISR + on-demand revalidation helper

**Purpose.** Set up Incremental Static Regeneration with the `revalidate: 60` baseline and the `invalidateConsumerPage(slug)` helper that Phase 3 will call when the restaurant updates settings.

**PRD section.** §2.2, §13.1.

**Files touched.**
- `lib/consumer/cache.ts` (new — `invalidateConsumerPage(slug)`, `invalidateMenu(restaurantId)`)
- `app/[locale]/r/[slug]/layout.tsx` (add `export const revalidate = 60`)
- `app/[locale]/r/[slug]/page.tsx` (same)
- Future-use: documented usage examples for Phase 3.

**MCP operations.** None.

**Combines with.** Could combine with C0.2, but kept separate because cache invalidation will have its own tests and the user benefits from seeing it isolated.

**Verification.**
- Edit a restaurant's display_name via Supabase MCP. Within 60 seconds, page reflects the change.
- Call `invalidateConsumerPage('karan-gupta')` via a dev endpoint (or a one-off script). Immediately revisit page → change reflected without waiting for the 60s.

**Stop signal.** Manual invalidation works; baseline 60s revalidate works.

---

## C0.4 — Locale toggle inside consumer pages

**Purpose.** Ensure NL/EN toggle works on the consumer surface the same way it works in onboarding (Phase 1 Polish #20 pattern — instant feedback + soft navigation).

**PRD section.** §2.5, §13.2.

**Files touched.**
- `components/consumer/LocaleToggle.tsx` (new — adapts the onboarding `LanguageToggle` for the consumer chrome)
- Reuses `lib/i18n/routing.ts` from Phase 1.

**MCP operations.** None.

**Verification.**
- Toggle NL → EN on `/r/karan-gupta` — URL switches to `/en/r/karan-gupta`, no full reload, restaurant header re-renders in English where translations exist.
- The optimistic active-pill switch fires immediately (Phase 1 Polish #20 behaviour).

**Stop signal.** Toggle feels instant on both desktop and mobile.

---

# Phase C1 — Schema additions

PRD references: §7, §8.1 RLS notes.

This phase is two prompts — one for the migration itself, one for verification. Schema first because every later phase reads from these tables.

## C1.1 — Apply all consumer-side schema additions

**Purpose.** Create every new table, enum, and column required by Phase 2 in one cohesive migration.

**PRD section.** §7.

**Files touched.**
- `migrations/2026XXXX_consumer_schema.sql` (new — full DDL)
- `TheTafel_Consumer_Schema_v1.0.sql` is the spec; this is the applied version.

**MCP operations.**
- `apply_migration` for the full DDL.
- For every new table, run a follow-up `list_tables` to confirm shape.
- For every new column added to `restaurants`, run a follow-up `execute_sql` to confirm the column exists and the default is correct.

**Tables created (per PRD §7.1):**
- `guests`
- `bookings`
- `booking_tables`
- `orders`
- `order_items`
- `tabs`
- `payment_intents`
- `menus`, `menu_categories`, `menu_items`, `menu_item_translations` (some may already exist from Phase 1 menu upload step — RECONCILE first via `list_tables` and adjust the migration)
- `magic_links`
- `consumer_audit_logs`

**Enums created (per PRD §7.3):**
- `booking_status`
- `order_status`
- `payment_intent_status`
- `payment_intent_purpose`
- `order_type`

**Columns added to `restaurants`** (per PRD §7.2):
Reconcile against the current live schema. Add only what's missing.

**RLS policies.** Every new table has RLS enabled at creation. Default policies per PRD §7.4. Public read for `restaurants`, `menus`, `menu_categories`, `menu_items` where `status='live'` and the row is published. No public read on `bookings`, `orders`, `guests`, `payment_intents`.

**Combines with.** None — single coherent migration.

**Verification.** Covered in C1.2.

**Stop signal.** Migration applies cleanly. No errors. `git log --oneline -3` shows the migration commit.

---

## C1.2 — Schema verification + RLS smoke tests

**Purpose.** Confirm the migration matches the PRD and that RLS policies actually deny anonymous access where they should.

**Files touched.**
- `scripts/verifySchema.ts` (new — one-off check)

**MCP operations.**
- For each new table, query its column list, types, defaults, indexes.
- Compare against PRD §7.
- Attempt a SELECT as anon role on `bookings`, `orders`, `guests`, `payment_intents` — must all return zero rows (denied by RLS).
- Attempt a SELECT as anon role on `menu_items` WHERE published — should return rows for published menus only.

**Verification.**
- Schema diff matches PRD.
- RLS denies anon reads on private tables.
- Public reads work on public-flagged rows.

**Stop signal.** Verification script passes; report shows zero schema-vs-PRD discrepancies and correct RLS behaviour.

---

# Phase C2 — Security primitives

PRD references: §8 in full, §13.5 doorman, §15.9 security per prompt.

This phase ships the libraries every public endpoint will use. Building these now prevents copy-paste-and-forget patterns that leak bugs.

## C2.1 — Rate limiting + Turnstile

**Purpose.** Standard public-endpoint protections, available as drop-in helpers.

**PRD section.** §8.2 rate limits, §8.3 Turnstile.

**Files touched.**
- `lib/security/rateLimit.ts` (new — wraps Upstash Redis with the rate-limit dimensions from PRD §8.2)
- `lib/security/turnstile.ts` (new — server-side token verification)
- `components/consumer/TurnstileWidget.tsx` (new — client widget)
- `env.example` update — add `TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`

**MCP operations.** None (no DB change). Set the env vars in Vercel via the dashboard or `vercel env add` (Ankur does this).

**Combines with.** Both go together — every protected endpoint uses both. Splitting would force every prompt to import from two new modules in one commit.

**Verification.**
- Hit a stubbed endpoint with rate limit 60/min from a single IP — 61st request returns 429.
- Submit a form with a missing/invalid Turnstile token — server rejects with 403.
- Submit with a valid token — accepted.

**Stop signal.** Both protections work in dev with explicit tests.

---

## C2.2 — Audit log helper + consumer doorman

**Purpose.** Make audit-log writes a one-liner everywhere; centralise the "is this restaurant allowed to accept consumer writes" check.

**PRD section.** §13.5, §13.9, §14.10.

**Files touched.**
- `lib/consumer/audit.ts` (new — `auditLog(restaurantId, eventType, eventData)`)
- `lib/consumer/guards.ts` (new — `assertConsumerWriteAllowed(restaurant, action)`)
- TypeScript types for `eventType` strings, exported as a union to prevent typos.

**MCP operations.** None.

**Verification.**
- Call `auditLog` from a test endpoint — row appears in `consumer_audit_logs`.
- Call `assertConsumerWriteAllowed(restaurantWithStatusOnboarding, 'create_booking')` — throws structured 409 error.
- Same call on live restaurant — passes.
- Call with `service_qr_enabled=false` and action `'create_qr_order'` — throws.

**Stop signal.** Both helpers return the right results across the truth table of restaurant states.

---

## C2.3 — Magic-link token system

**Purpose.** Generate, store, verify, and consume short-lived single-use tokens for booking/order management URLs.

**PRD section.** §8.7.

**Files touched.**
- `lib/consumer/magicLinks.ts` (new — `createMagicLink`, `verifyMagicLink`, `consumeMagicLink`)
- Migration applied in C1 already created `magic_links` table.

**Token mechanics.**
- 32 random bytes, base64url-encoded → 43-char token.
- SHA-256 hash stored in DB; plaintext sent in URL or email/WhatsApp message.
- `purpose` enum: `manage_booking`, `view_order`, `cancel_booking`.
- TTL: 30 days for `manage_booking`, 7 days for `view_order`.
- Single-use for `cancel_booking`; multi-use (but logged) for `manage_booking` and `view_order`.

**MCP operations.** None (table exists from C1).

**Verification.**
- Generate a token, store, verify with the plaintext — passes.
- Verify with wrong plaintext — fails.
- Consume a single-use token, verify the same token again — fails.
- Generate, wait past TTL (simulated by manipulating `expires_at`), verify — fails.

**Stop signal.** All token lifecycle paths tested.

---

## C2.4 — Input sanitisation library

**Purpose.** Standard text-cleaning, phone normalisation, email normalisation used by every form.

**PRD section.** §8.8.

**Files touched.**
- `lib/consumer/sanitise.ts` (new — `cleanText`, `normalisePhone`, `normaliseEmail`)
- `lib/consumer/validation.ts` (new — Zod schemas for guest details, booking input, order input)

**Functions.**
- `cleanText(input, { maxLength })` — strips control chars, NFKC unicode normalise, trims, length-limits.
- `normalisePhone(input, defaultCountry='NL')` — uses `libphonenumber-js` to E.164.
- `normaliseEmail(input)` — lowercases, trims, validates format.

**MCP operations.** None.

**Verification.**
- Unit tests for edge cases (script tags in name, weird unicode, international phone formats, etc.).

**Stop signal.** All tests pass.

---

# Phase C3 — Notifications infrastructure

PRD references: §10.

This phase lets every flow trigger a "send this notification" in one line without duplicating Resend/WhatsApp boilerplate. WhatsApp template registration with Meta is partly external — handled in C3.2.

## C3.1 — Resend email templates and dispatcher

**Purpose.** All Phase 2 transactional emails go through one dispatcher with React Email templates.

**PRD section.** §10.1.

**Files touched.**
- `lib/notifications/sendEmail.ts` (new — wraps Resend, takes a template name + props, renders + sends)
- `emails/BookingConfirmed.tsx` (new — React Email)
- `emails/BookingCancelled.tsx`
- `emails/OrderConfirmed.tsx`
- `emails/OrderReady.tsx`
- `emails/DepositCaptured.tsx`
- `emails/DepositRefunded.tsx`
- `messages/nl.json` + `messages/en.json` updates for email copy

**Branding.** Restaurant logo (if uploaded), restaurant name, accent colour from restaurant settings (Phase 1 onboarding step 7 saves these). The Tafel wordmark in footer.

**Plain-text fallback.** Generated automatically by React Email from the JSX.

**Inline images.** CID attachments (Phase 1 learning — Gmail blocks `data:` URLs).

**Combines with.** All emails are one prompt because they share the dispatcher and the layout component.

**Verification.**
- Trigger each template via a test endpoint, deliver to a real inbox (Ankur's).
- Inspect rendered HTML in Gmail, Outlook web, Apple Mail.
- Verify plain-text fallback renders correctly.
- Verify restaurant branding (logo, accent colour) shows correctly.
- Verify NL is default; trigger with `locale='en'` and confirm English template renders.

**Stop signal.** All six emails render correctly across the three test clients.

---

## C3.2 — WhatsApp Business templates + dispatcher

**Purpose.** Same pattern for WhatsApp. Requires Meta-approved templates per PRD §10.2.

**PRD section.** §10.2.

**External dependency.** WhatsApp Business Cloud API setup at Meta. Templates must be submitted and approved before sending. This typically takes 1–2 weeks per Phase 1 launch checklist.

**Strategy if templates not yet approved at C3.2 time.** Build the dispatcher with a feature flag `WHATSAPP_ENABLED=false`. Calls silently no-op (but log to audit). When approved, flip flag and re-run integration tests.

**Files touched.**
- `lib/notifications/sendWhatsApp.ts` (new — Meta Cloud API wrapper)
- `lib/notifications/whatsappTemplates.ts` (new — template name → variables map, kept in sync with Meta-approved templates)
- Env vars: `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_ENABLED`

**Templates to register at Meta (per PRD §10.2):**
- booking_confirmed
- booking_reminder_24h
- booking_reminder_2h
- order_received
- order_ready
- deposit_refunded

Each template has Dutch and English variants. Each variant is a separate Meta submission.

**Combines with.** Dispatcher + first template registration in one prompt; subsequent template approvals (if delayed) happen externally and don't need code prompts unless the template body changes.

**Verification.**
- With `WHATSAPP_ENABLED=false`: trigger any send → no real send, but audit log entry written.
- With `WHATSAPP_ENABLED=true` and approved templates: send `booking_confirmed` to Ankur's WhatsApp — message arrives within seconds, variables substituted correctly.

**Stop signal.** Either: (a) end-to-end WhatsApp delivery to a real phone, or (b) feature-flagged no-op verified and templates submitted to Meta with confirmation screenshot.

---

## C3.3 — Notification dispatcher with email/WhatsApp fallback

**Purpose.** Single `notify(event, restaurantId, recipient, payload)` function that picks email-only, WhatsApp-only, or both, with fallback if WhatsApp fails.

**PRD section.** §10.2 fallback rule.

**Files touched.**
- `lib/notifications/notify.ts` (new — top-level dispatcher)
- Logic: for each event type, decide which channels apply for this restaurant (based on subscription tier + Meta-verification status + guest opt-ins).

**MCP operations.** None.

**Verification.**
- Restaurant with WhatsApp verified + Premium tier + recipient consented → both email and WhatsApp fire.
- Restaurant with WhatsApp NOT verified → email only fires, no error.
- WhatsApp send fails (mocked) → email fires as fallback, audit log notes the failure.
- Recipient explicitly opted out of marketing → transactional still sends, marketing does not.

**Stop signal.** Matrix verified.

---

# Phase C4 — Reservation flow

PRD references: §3.1 narrative, §4 detailed step specs, §8 security, §9 payments, §10 notifications.

C4 is the longest phase. Each sub-step is a screen or a server endpoint. The user can confirm progress after each.

## C4.1 — Availability engine

**Purpose.** Pure-logic library that, given a restaurant and a date, returns the list of available slots with capacity hints.

**PRD section.** §4 R2, §2.3 real-time availability, §11 perf targets.

**Files touched.**
- `lib/booking/computeAvailability.ts` (new — pure function, no DB)
- `lib/booking/queries.ts` (new — fetches inputs: opening_hours, tables, occupancy_duration, turnover_buffer, existing bookings for date)
- `app/api/v1/public/[slug]/availability/route.ts` (new GET handler)

**Inputs to the pure function.**
- Day's opening hours
- Tables (zones, capacities)
- Occupancy duration (single value or per-party-size map)
- Turnover buffer
- Already-booked slots for the day
- Requested party size

**Output.**
- Array of slot objects: `{ time: '19:00', zone_options: [zoneId, ...], remaining_capacity: 3 }`
- Sorted ascending by time
- Closed days return empty array

**Performance.** Endpoint must return in ≤ 200ms warm, ≤ 800ms cold (PRD §11.1). Cached behind a 30s edge cache keyed by `(slug, date, partySize)`.

**Combines with.** Pure logic + the endpoint together because they're a single concern.

**Verification.**
- Unit tests covering: empty hours, single-shift restaurant, two-shift restaurant (lunch + dinner), restaurant with multiple zones, party size at limit, busy day with many existing bookings.
- Hit endpoint with various parameters, verify warm response ≤ 200ms (Vercel Analytics).

**Security checklist.**
- Rate limit: 60/IP/min applied via C2.1.
- No CAPTCHA (read endpoint).
- Audit log: not required for reads.
- Payload validation: zod for query params.

**Stop signal.** Tests pass + warm response time meets target.

---

## C4.2 — Reservation entry point and step shell

**Purpose.** The `/r/[slug]/book` route with the empty step shell — wizard layout, progress dots, back button, NL/EN toggle. No actual form yet.

**PRD section.** §3.1 R0 framing, §4 step shell.

**Files touched.**
- `app/[locale]/r/[slug]/book/page.tsx` (new)
- `app/[locale]/r/[slug]/book/layout.tsx` (new — book-specific chrome on top of consumer layout)
- `components/consumer/booking/BookingStepShell.tsx` (new)
- Client-side step state machine in `lib/booking/state.ts` (Zustand or simple React Context, simple wins)

**Verification.**
- Visit `/r/karan-gupta/book` — page renders header, empty step shell, "Step 1 of 6" indicator (skeleton).
- Browser back button works correctly (no double-history-entry bugs).
- NL/EN toggle works.

**Stop signal.** Shell visible and stable on desktop + mobile.

---

## C4.3 — R1: date and party size

**Purpose.** First real step. Calendar + party-size selector.

**PRD section.** §4 R1.

**Files touched.**
- `components/consumer/booking/DatePicker.tsx` (new — calendar grid, NL/EN day labels)
- `components/consumer/booking/PartySizeSelector.tsx` (new — pill row)
- `components/consumer/booking/StepR1.tsx` (new — composes the two)
- Closed-day determination via `lib/booking/openingHours.ts` (new helper)

**State.** Selections are pushed into the booking state machine but no server call yet.

**Validation.** Client-side: date within window, party size within limit. Server-side validation happens in C4.4 when availability is fetched.

**Verification.**
- Calendar greys out closed days.
- Party size > `max_party_size_online` greys out the "8+" pill and shows the "Contact restaurant" notice.
- "Continue" enables only when both valid.
- Tab/keyboard navigation works.

**Stop signal.** Step usable on desktop + mobile + keyboard.

---

## C4.4 — R2: slot grid + live availability

**Purpose.** Fetch slots from C4.1's endpoint and render the slot grid.

**PRD section.** §4 R2.

**Files touched.**
- `components/consumer/booking/SlotGrid.tsx` (new)
- `components/consumer/booking/StepR2.tsx` (new — owns the fetch state)
- `lib/booking/useAvailability.ts` (new — SWR-style hook with stale-while-revalidate)

**Display.**
- Slots grouped morning / lunch / dinner.
- Capacity hint ("3 tafels") shown only when < 4 tables remaining.
- Loading skeleton during fetch.
- Empty state if no availability ("Geen tafels beschikbaar op deze dag — kies een andere datum").
- Error state if availability API fails.

**Combines with.** Stand-alone. The grid is a UI step; the underlying API was C4.1.

**Verification.**
- Pick a date with mixed availability — grid renders correctly.
- Pick a closed date — empty state.
- Network throttle to slow 3G — loading skeleton appears, then grid.
- Disconnect network — error state with retry button.

**Stop signal.** Slot grid usable, performant, and gracefully degrades.

---

## C4.5 — R3 + R4: zone (optional) and guest details

**Purpose.** Two PRD steps in one prompt because they share a screen on most restaurants (zone is often skipped, and even when present, sits visually on the same scroll).

**PRD section.** §4 R3, R4.

**Files touched.**
- `components/consumer/booking/StepR3.tsx` (new — zone picker, may be skipped)
- `components/consumer/booking/StepR4.tsx` (new — guest details form)
- `lib/booking/guestForm.ts` (new — Zod schema for the form, plus phone E.164 helper)
- `lib/booking/visibleSteps.ts` (new — decides whether R3 is shown)

**Combines with.** R3 + R4 together. If R3 is skipped (single-zone restaurant), R4 just renders alone.

**Validation per PRD §4 R4.**
- Name: required, ≤ 80 chars, control chars stripped.
- Email: required, RFC 5322-light, server confirms with DNS MX at submit (C4.7).
- Phone: required, E.164 stored.
- Note: optional, ≤ 200 chars, HTML stripped.
- Marketing consent: optional checkbox, default off.

**Verification.**
- Single-zone restaurant: R3 skipped automatically; user sees only R4.
- Multi-zone restaurant: R3 shown with available zones for the selected slot.
- All required fields validated client-side on blur with inline errors.
- Continue disabled until all required valid.

**Stop signal.** Form usable + validation clean.

---

## C4.6 — R5: no-show deposit + Mollie payment

**Purpose.** When deposit required, render the amount, fire the Mollie payment, handle the redirect/return.

**PRD section.** §4 R5, §9.2 payment intent lifecycle.

**Files touched.**
- `components/consumer/booking/StepR5.tsx` (new — deposit ask + Mollie redirect button)
- `app/api/v1/public/[slug]/book/start-deposit/route.ts` (new POST — creates payment intent, returns Mollie checkout URL)
- `app/[locale]/r/[slug]/book/return/[intentId]/page.tsx` (new — return handler, server component verifies Mollie status)
- `lib/mollie/createConnectedPayment.ts` (new — wraps Mollie API for the restaurant's connected org)
- `app/api/webhooks/mollie/consumer/route.ts` (new POST — webhook for async status updates)

**Mollie flow per PRD §9.2.**
1. Client clicks "Pay deposit."
2. POST to `start-deposit` with the in-progress booking payload (idempotency-keyed).
3. Server creates `payment_intents` row, calls Mollie, returns checkout URL.
4. Client redirects browser to Mollie.
5. Guest pays via iDEAL primary, card fallback.
6. Mollie redirects to `/return/[intentId]`.
7. Return handler fetches Mollie status authoritatively, updates `payment_intents.status`.
8. If paid → render R6 with deposit confirmed banner.
9. If failed → back to R5 with retry.
10. Webhook fires asynchronously; handler is idempotent.

**Security checklist.**
- Rate limit: 5 POST/IP/hour to `start-deposit`.
- Idempotency: `Idempotency-Key` header required.
- Audit log on every state transition.
- Webhook HMAC verified.
- Mollie payment status never trusted from URL — always re-fetched.

**Combines with.** Single coherent flow.

**Verification.**
- Test mode iDEAL — full happy path returns to R6 with deposit confirmed.
- Test mode card declined — return to R5 with retry.
- Hit return URL with stale intent ID — 404.
- Webhook delivery confirmed in Mollie dashboard + audit log.

**Stop signal.** End-to-end deposit flow works in Mollie test mode.

---

## C4.7 — R6: review + submit (transactional booking insert)

**Purpose.** The actual booking creation. Transaction, advisory lock, idempotency.

**PRD section.** §4 R6, §2.3 optimistic locking, §8 security.

**Files touched.**
- `components/consumer/booking/StepR6.tsx` (new — review screen + submit button)
- `app/api/v1/public/[slug]/book/route.ts` (new POST — main booking endpoint)
- `lib/booking/transactionalInsert.ts` (new — wraps the advisory-lock + insert)
- `lib/booking/ref.ts` (new — generates `XXX-XXXX` booking refs)

**Endpoint logic.**
1. Validate payload (Zod schema).
2. Verify Turnstile token.
3. Rate limit checks.
4. Apply idempotency key.
5. `assertConsumerWriteAllowed(restaurant, 'create_booking')`.
6. Open transaction.
7. Acquire advisory lock on `restaurant_id`.
8. Re-check slot availability for the requested time and party.
9. Upsert `guests` (lookup by email_lower + phone_normalised, insert if missing).
10. Insert `bookings` row.
11. Insert one `booking_tables` row (Phase 4 may insert multiple).
12. Link `payment_intent_id` if deposit was paid.
13. Generate booking_ref.
14. Generate magic-link token, store hash.
15. Commit + release lock.
16. Fire `booking.confirmed` event → notification dispatcher (C3.3).
17. Audit log.

**Errors.**
- `slot_taken` → return 409 with three nearest alternative slots.
- Mollie verification failed → return 402 with retry hint.
- Idempotency key match → return existing booking_ref + 200.

**Security checklist.**
- Turnstile token verified.
- Rate limit: 5/IP/hour + 3/(email,phone)/hour.
- Idempotency-Key required.
- Audit log on success and on every failure type.
- Booking ref generated server-side (never client).
- Magic-link token cryptographically random; hashed in DB.

**Combines with.** Tight coupling between the review UI and the submit endpoint; one prompt.

**Verification.**
- Submit a valid booking — row appears in `bookings`, guest in `guests`, audit log entry, confirmation email sent.
- Submit again with same idempotency key — same booking returned, no duplicate.
- Two parallel submits for the same slot — one wins, one gets 409 with alternatives.
- Tamper with the payload (e.g. send party_size=20 when limit is 8) — 400 validation error.
- Skip Turnstile token — 403.

**Stop signal.** End-to-end booking insert works, all edge cases handled.

---

## C4.8 — R7 confirmation + manage-booking magic link + cancellation

**Purpose.** Final screen + the post-confirmation magic-link page.

**PRD section.** §4 R7, §3.4 cancellation, §8.7 magic links.

**Files touched.**
- `components/consumer/booking/StepR7.tsx` (new — confirmation screen)
- `app/[locale]/r/[slug]/booking/[token]/page.tsx` (new — magic-link manage page)
- `components/consumer/booking/ManageBooking.tsx` (new — manage page UI)
- `app/api/v1/public/[slug]/book/cancel/route.ts` (new POST — cancel + refund)
- `lib/booking/cancellation.ts` (new — policy check, refund decision)
- `lib/booking/icsExport.ts` (new — generate .ics calendar invite)

**Confirmation R7 features.**
- Big tick + heading
- Booking ref in monospace pill
- "Add to calendar" — generates `.ics` inline
- "Manage booking" link → magic-link URL
- Cancellation deadline shown plainly

**Manage page features.**
- Show booking details
- "Cancel booking" button — opens a confirmation modal showing refund amount (if any)
- "Request a change" — sends a structured message to the restaurant (Phase 3 dashboard receives; for now, email to `hallo@thetafel.nl`)

**Cancellation logic.**
1. Verify magic-link token (consume if action is cancel).
2. Check cancellation policy window.
3. If within refund window → call Mollie refund API, update `payment_intents.status='refunded'`, audit log.
4. Update `bookings.status='cancelled'`.
5. Fire `booking.cancelled` notification (email + WhatsApp).

**Security checklist.**
- Magic-link token verified + consumed for cancel.
- Rate limit: 10 cancels/IP/hour.
- Audit log on every action.
- Refund initiated only after policy check; never trust the client's "I want a refund" claim.

**Combines with.** Confirmation screen + manage page + cancel endpoint are one coherent feature.

**Verification.**
- Confirmation screen renders correctly with all info.
- .ics download produces a valid calendar entry.
- Manage link opens manage page; details correct.
- Cancel outside refund window → no refund, booking cancelled.
- Cancel inside refund window → refund initiated, both notifications fire.
- Consume the token, click again → 410 Gone or similar.

**Stop signal.** Full booking lifecycle (create → confirm → cancel → refund) works end-to-end.

---

# Phase C5 — QR ordering flow

PRD references: §3.2 narrative, §5 detailed step specs.

## C5.1 — Q0: QR landing and table validation

**Purpose.** Validate the scanned URL parameters and show the welcome screen.

**PRD section.** §5 Q0.

**Files touched.**
- `app/[locale]/r/[slug]/qr/[tableId]/page.tsx` (new)
- `components/consumer/qr/QrWelcome.tsx` (new)
- `lib/qr/resolveTable.ts` (new — validates `tableId` belongs to restaurant)

**Verification.**
- Valid scan: shows welcome with correct table label.
- Invalid `tableId`: 404 with helpful "Table not recognised — please ask staff" message.
- Restaurant with QR disabled: redirect to /r/[slug] with explanation.

**Stop signal.** Both valid and invalid scans handled cleanly.

---

## C5.2 — Q1: menu rendering

**Purpose.** The menu browse screen with category chips + item cards. Most reusable component in Phase 2 (also used by takeaway).

**PRD section.** §5 Q1.

**Files touched.**
- `components/consumer/menu/MenuBrowser.tsx` (new — top-level layout)
- `components/consumer/menu/CategoryChips.tsx` (new — sticky chip bar)
- `components/consumer/menu/MenuItemCard.tsx` (new)
- `components/consumer/menu/AllergenIcons.tsx` (new — Phosphor + custom SVG mix)
- `app/api/v1/public/[slug]/menu/route.ts` (new GET — cached)
- `lib/menu/fetchMenu.ts` (new — DB query for menu data, includes filtering by context: qr / takeaway / both)

**Performance.** Menu fetch warm ≤ 400ms (PRD §11.1). Cached via ISR `revalidate: 60` + on-demand invalidation.

**Display.**
- Categories in sticky chip bar at top.
- Items as cards with name, description, price, optional photo, allergen icons.
- "Add" / quantity stepper per card.
- Item-note input (collapsible) if `qr_item_notes_enabled`.

**Combines with.** Menu API + menu UI in one prompt — they're a single concern and avoiding the round-trip churn of separate prompts.

**Verification.**
- Menu loads for Karan's test restaurant.
- Category scroll-spy: tapping a chip scrolls to the section + highlights.
- Adding items updates the local cart state.
- Items flagged `takeaway_only` don't appear in QR context.
- Allergen icons render correctly per item.
- Warm fetch ≤ 400ms.

**Stop signal.** Menu usable on mobile, fast, and respects context filtering.

---

## C5.3 — Q2: cart state and drawer

**Purpose.** Persistent cart in localStorage, drawer UI for review/edit.

**PRD section.** §5 Q2.

**Files touched.**
- `lib/cart/cartState.ts` (new — Zustand store with localStorage persistence, scoped by restaurant slug)
- `components/consumer/menu/CartDrawer.tsx` (new — bottom sheet on mobile, side panel on desktop)
- `components/consumer/menu/StickyCartFooter.tsx` (new — "X items — €Y" sticky CTA)
- `lib/cart/pricing.ts` (new — subtotal, VAT, total computation server-side AND client-side; client computes for preview, server re-computes on submit)

**Scoping.** Cart is scoped per (slug, context). Visiting a different restaurant or switching between QR and takeaway uses separate carts.

**Persistence.** Cart survives page reload via localStorage. Cleared on order submit success.

**Verification.**
- Add items, reload page — cart persists.
- Quantity stepper in drawer works correctly.
- Remove item works.
- Switch restaurants — cart is separate.
- Subtotal / VAT / total numbers correct.

**Stop signal.** Cart durable + correct totals.

---

## C5.4 — Q3: pay-mode chooser

**Purpose.** When both pay-now and pay-at-table are available, ask the guest.

**PRD section.** §5 Q3.

**Files touched.**
- `components/consumer/qr/PayModeChooser.tsx` (new)
- `lib/qr/payModesForRestaurant.ts` (new — returns enabled modes per restaurant)

**Display.** Two cards side-by-side on desktop, stacked on mobile. Pay-now is the highlighted default.

**Skipped when.** Only one mode is enabled.

**Verification.**
- Restaurant with both modes: chooser renders, selection moves to Q4.
- Restaurant with pay-now only: skipped automatically.
- Restaurant with pay-at-table only: skipped automatically.

**Stop signal.** Chooser logic respects per-restaurant flags.

---

## C5.5 — Q4: order submit (pay-now and pay-at-table)

**Purpose.** Create the order. For pay-now: full Mollie flow. For pay-at-table: open or join a `tabs` row.

**PRD section.** §5 Q4, §9 payments.

**Files touched.**
- `app/api/v1/public/[slug]/order/route.ts` (new POST — main order endpoint)
- `lib/orders/transactionalInsert.ts` (new)
- `lib/orders/openOrJoinTab.ts` (new — for pay-at-table)

**Pay-now flow.**
1. Validate payload + Turnstile + rate limits + idempotency.
2. Re-fetch menu items server-side; re-compute prices (do NOT trust client's totals — PRD §14.8).
3. `assertConsumerWriteAllowed(restaurant, 'create_qr_order')`.
4. Create `payment_intents` row.
5. Call Mollie connected payment.
6. Redirect to Mollie.
7. Return handler creates the order on confirmed payment.
8. Notification fires.

**Pay-at-table flow.**
1. Same validation.
2. Find or create open `tabs` row for the table for the current shift.
3. Insert order linked to the tab.
4. No Mollie call.
5. Order goes to kitchen view immediately.

**Combines with.** Both paths in one endpoint with branching, because the validation/audit/RLS is identical. Single prompt for one logical write.

**Security checklist.**
- Turnstile on submit.
- Rate limit: 10/IP/hour, 5/(email,phone)/hour.
- Server re-computes total from menu_items.price_cents.
- Audit log every state change.
- Mollie webhook idempotent.

**Verification.**
- Pay-now happy path: Mollie test mode iDEAL, returns, order appears with status `confirmed`.
- Pay-at-table: order appears with `payment_status='pending'`, linked to a tab.
- Tamper with line prices: server uses authoritative prices, ignores tampering.

**Stop signal.** Both pay modes work end-to-end.

---

## C5.6 — Q5: confirmation and status polling

**Purpose.** Show the order confirmation + poll for status updates.

**PRD section.** §5 Q5.

**Files touched.**
- `app/[locale]/r/[slug]/qr/order/[orderToken]/page.tsx` (new — uses magic-link)
- `components/consumer/qr/OrderStatus.tsx` (new — polling component)
- `app/api/v1/public/orders/[token]/status/route.ts` (new GET — returns minimal status)
- `lib/orders/statusLabels.ts` (new — friendly Dutch/English labels per status)

**Polling per PRD §5 Q5.** First 10 minutes: every 8 seconds. Next 30 minutes: every 30 seconds. After 40 minutes: poll stops.

**Display.**
- "Bestelling ontvangen — tafel 12" / "Order received — table 12"
- Order code (8 chars)
- Status line with cheerful copy per state
- "Need help? Ask a staff member" footer

**Verification.**
- Order placed → confirmation shows.
- Update order status via MCP → page reflects within 8 seconds.
- Wait 41 minutes (or simulate) → polling stops.
- Network error during polling → silent, retries.

**Stop signal.** Status updates feel responsive without server pressure.

---

# Phase C6 — Takeaway flow

PRD references: §3.3 narrative, §6 detailed step specs.

C6 heavily reuses C5 components. Each prompt is shorter than C5's equivalents because the work is mostly composition.

## C6.1 — T0 + T1: landing and menu (reuse Q1)

**Purpose.** Takeaway landing page + menu browse.

**PRD section.** §6 T0, T1.

**Files touched.**
- `app/[locale]/r/[slug]/order/page.tsx` (new)
- `components/consumer/takeaway/TakeawayLanding.tsx` (new — wraps `RestaurantHeader` with takeaway-specific copy + closed-day handling)
- Reuses `MenuBrowser` from C5.2 with `context='takeaway'` prop.

**Closed-day handling.**
- If restaurant closed today AND no upcoming hours within 7 days → show "Currently unavailable for takeaway."
- If closed today but open tomorrow → friendly "Closed today — next pickup tomorrow at 17:00" message + disable order form.
- If open: show order form normally.

**Verification.**
- Open restaurant: full flow proceeds.
- Closed today, open tomorrow: friendly message + disabled state.
- Permanently closed (no upcoming hours): unavailable page.

**Stop signal.** Both states render correctly.

---

## C6.2 — T3: pickup time picker

**Purpose.** Grid of pickup time slots, respecting kitchen capacity.

**PRD section.** §6 T3.

**Files touched.**
- `components/consumer/takeaway/PickupTimePicker.tsx` (new)
- `lib/takeaway/computePickupSlots.ts` (new — pure function similar to availability engine)
- `app/api/v1/public/[slug]/pickup-slots/route.ts` (new GET)

**Inputs to pure function.**
- Today's opening hours
- `min_lead_time_minutes`
- Current backlog of confirmed orders per slot (kitchen capacity)
- Current time

**Verification.**
- Slot list reflects opening hours + lead time.
- Full slots show as greyed/unavailable.
- "Now + N min" earliest slot shown prominently.

**Stop signal.** Picker correct under multiple kitchen-load scenarios.

---

## C6.3 — T4 + T5: guest details + payment

**Purpose.** Form + Mollie payment (mandatory upfront for takeaway).

**PRD section.** §6 T4, T5.

**Files touched.**
- `components/consumer/takeaway/StepT4.tsx` (new — guest form, reuses `StepR4` logic)
- `components/consumer/takeaway/StepT5.tsx` (new — Mollie kickoff)
- `app/api/v1/public/[slug]/takeaway/route.ts` (new POST — order endpoint)
- Reuses `transactionalInsert` from C5.5 with `order_type='takeaway'` and `pickup_time` set.

**Security checklist.**
- Identical to QR order endpoint per C5.5.

**Verification.**
- Submit happy path → Mollie redirect → return → order created with `pickup_time` set.
- All edge cases from C5.5 also covered.

**Stop signal.** End-to-end takeaway order works.

---

## C6.4 — T6: confirmation + ready notification

**Purpose.** Confirmation screen + the second "your order is ready" notification when restaurant marks ready.

**PRD section.** §6 T6.

**Files touched.**
- `app/[locale]/r/[slug]/order/confirmed/[token]/page.tsx` (new)
- `components/consumer/takeaway/OrderConfirmed.tsx` (new)
- Hook into the order status update so when status moves to `ready`, a one-shot "order ready" WhatsApp+email fires.

**Implementation note for ready-notification.**
- Listen for status changes via a Supabase trigger that writes to an `events` queue table.
- Background worker (cron job every 30 seconds in Phase 2; Supabase Edge Function in Phase 3+) processes the queue and calls the notification dispatcher.
- `orders.ready_notified_at` set to prevent duplicate sends.

**Verification.**
- Confirmation page shows correctly.
- Move an order's status to `ready` via MCP → within 30 seconds, ready notification fires.
- Re-mark `ready` again → no duplicate (idempotent on `ready_notified_at`).

**Stop signal.** Both initial and ready notifications fire, no duplicates.

---

# Phase C7 — Thin-slice "Today" view for restaurants

PRD references: §16 boundary note — minimal ops surface so restaurants can see incoming activity in Phase 2.

This is NOT the full Phase 3 dashboard. It's a stopgap that surfaces incoming bookings/orders without any of the management UI that Phase 3 will bring.

## C7.1 — Today's bookings list (read-only)

**Purpose.** Restaurant owner can see today's bookings on one page.

**Files touched.**
- `app/[locale]/dashboard/today/page.tsx` (new)
- `components/dashboard/today/BookingsList.tsx` (new)
- Auth-gated (existing Phase 1 auth flow)

**Display.**
- Sorted by time ascending.
- Each row: time, guest name, party size, zone, deposit status, status badge.
- Click row → modal with full booking details + magic-link to share with the guest.

**No edit actions in Phase 2.** Add only via Phase 3.

**Verification.**
- Bookings created via the consumer flow appear here within 60 seconds.
- Restaurant owners see only their own restaurant's bookings (RLS).

**Stop signal.** Owners can see activity.

---

## C7.2 — Today's orders list (read-only)

**Purpose.** Same idea for orders — QR + takeaway combined.

**Files touched.**
- `components/dashboard/today/OrdersList.tsx` (new)
- Added to `app/[locale]/dashboard/today/page.tsx`

**Display.**
- Two tabs: "QR (X)" and "Takeaway (Y)".
- Each row: time received, items, total, status, table (QR) or pickup time (takeaway).
- Click row → modal with full order details.

**Verification.**
- Both types appear.
- Status badges color-coded.

**Stop signal.** Owners see incoming orders.

---

## C7.3 — Mark order as ready (single action)

**Purpose.** The one write action allowed in this Phase 2 thin slice — mark an order ready, which triggers the ready notification (C6.4).

**Files touched.**
- `components/dashboard/today/MarkReadyButton.tsx` (new)
- `app/api/v1/restaurants/[id]/orders/[orderId]/mark-ready/route.ts` (new POST)

**Security checklist.**
- Auth required.
- Restaurant ownership verified.
- Audit log entry.
- Idempotent: marking ready twice doesn't fire two notifications.

**Verification.**
- Click button → order status moves to `ready` → notification fires within 30 seconds.
- Click again → no duplicate notification.

**Stop signal.** Restaurants can mark orders ready without waiting for the full dashboard.

---

# Phase C8 — GDPR + cookies + data tools

PRD references: §12 GDPR.

## C8.1 — Cookie consent banner

**Purpose.** Minimal banner shown when non-essential cookies present.

**Files touched.**
- `components/consumer/CookieBanner.tsx` (new — appears on all consumer pages)
- `lib/consent/cookieConsent.ts` (new — small state + persistence)

**Behaviour per PRD §12.6.**
- Banner shows on first visit + when consent expires (12 months).
- Three buttons: Accept all / Reject all / Settings.
- Default: rejected (no non-essential cookies set until consent).
- Plausible runs cookieless, so doesn't require consent.

**Verification.**
- First visit: banner appears.
- Accept all → banner dismisses, consent stored.
- Reject all → banner dismisses, no non-essential cookies set.
- Settings → fine-grained options.

**Stop signal.** Banner works and respects choices.

---

## C8.2 — Privacy policy page wired

**Purpose.** Public privacy page reachable from every consumer-page footer.

**Files touched.**
- `app/[locale]/privacy/page.tsx` (new — pull final text from legal review when ready; ship a draft pre-launch with all sub-processors per PRD §12.5)
- Footer component update to link.

**Verification.**
- Privacy page renders in NL and EN.
- Footer link present on consumer pages.
- All sub-processors listed.
- Contact form for subject-rights requests works.

**Stop signal.** Page live + complete.

---

## C8.3 — Guest data export tool (admin-only)

**Purpose.** Manual data-export tool used internally to fulfil subject-rights access requests.

**Files touched.**
- `app/api/admin/gdpr/export/route.ts` (new POST — protected by admin auth)
- `lib/gdpr/buildExport.ts` (new — composes JSON of all data linked to a guest)
- `gdpr_pii_columns.sql` (new — explicit list of PII columns; used by the export tool)

**Verification.**
- Send an access request via the privacy page.
- Run the export tool with the guest's email.
- Receive a JSON file with all their bookings, orders, payment intents, marketing consent.
- No data from other guests leaks in.

**Stop signal.** Tool returns complete + isolated data.

---

# Phase C9 — Hardening + launch prep

PRD references: §8 security, §11 performance, §15 how Claude responds.

This phase is where we earn the right to launch publicly. Skipping anything here is dangerous.

## C9.1 — Security review + threat model

**Purpose.** Apply the threat model checklist (PRD §8.9) to every public endpoint built in Phase 2.

**Files touched.**
- `SECURITY_REVIEW.md` (new — checklist filled per endpoint)
- Patch any gaps found.

**Process.**
1. Enumerate every `/api/v1/public/...` route.
2. For each, fill in the 8-point checklist from PRD §8.9.
3. Document gaps.
4. Patch gaps in follow-up prompts.

**Verification.**
- Document reviewed by Ankur.
- No `?` or `n/a` left blank — every cell has a substantive answer.

**Stop signal.** All endpoints cleared.

---

## C9.2 — Performance verification

**Purpose.** Measure against PRD §11.1 targets and tune the hot paths.

**Files touched.**
- `PERF_REPORT.md` (new — measurements)
- Tuning patches as needed.

**Measurements.**
- TTFB for `/r/[slug]/` — target ≤ 400ms p75
- LCP for the same — target ≤ 1.8s p75
- Availability API warm — target ≤ 200ms
- Booking submit (R6) server work — target ≤ 800ms
- Menu fetch warm — target ≤ 400ms

**Tools.** Vercel Analytics, Lighthouse, plus custom timing headers.

**Stop signal.** All targets met or exceeded.

---

## C9.3 — End-to-end smoke tests

**Purpose.** Automated tests that prove the three flows work in CI.

**Files touched.**
- `tests/e2e/reservation.spec.ts` (new — Playwright)
- `tests/e2e/qr.spec.ts`
- `tests/e2e/takeaway.spec.ts`
- CI pipeline update to run them.

**Coverage.**
- Reservation: happy path, slot taken, cancellation with refund.
- QR: pay-now happy, pay-at-table, status update.
- Takeaway: happy path, closed-day rejection.

**Verification.**
- CI pipeline green on a fresh PR.

**Stop signal.** All three suites green.

---

## C9.4 — Launch readiness checklist

**Purpose.** Final sweep before flipping the consumer routes on for the public.

**Files touched.**
- `LAUNCH_CHECKLIST.md` (new — checklist)
- No code changes unless gaps are found.

**Checklist.**
- [ ] All env vars set in Vercel prod
- [ ] Mollie connected accounts working in prod mode (test transaction)
- [ ] WhatsApp templates approved by Meta OR feature flag set false
- [ ] Resend domain verified, all templates send
- [ ] Privacy policy and DPA reviewed by lawyer (if not yet, flag as pre-launch blocker)
- [ ] CSP headers active (test with `curl -I`)
- [ ] Rate limits configured at production-scale
- [ ] Turnstile site keys for prod
- [ ] Sentry / error tracking wired (or noted as Phase 3)
- [ ] Backups configured per PRD §11.6
- [ ] On-call rotation defined (Ankur + Deepak)
- [ ] Launch comms drafted (email to first restaurants)

**Stop signal.** Every box ticked or explicit "deferred to post-launch with risk noted."

---

## 2. After Phase 2 — what comes next

After C9.4 ships, Phase 2 is done. The next chat starts **Phase 3** (restaurant dashboard).

Before opening the Phase 3 chat:

1. Write a new opening prompt summarising what Phase 2 shipped and any deferred Phase 2 items.
2. Document any Phase 2 items intentionally pushed to Phase 3 (e.g. full WhatsApp templates if Meta verification was delayed).
3. Write the Phase 3 PRD + Build Plan + Schema as their own document set.

---

## 3. Glossary additions

(Phase-2-specific terms not in PRD §18 glossary.)

- **Thin-slice "Today" view** — the minimum read-only restaurant-facing surface (C7) that lets restaurants see incoming bookings/orders before Phase 3 dashboard exists.
- **Availability engine** — the pure function in `lib/booking/computeAvailability.ts` that, given inputs, returns the slot list. Stateless and easy to test.
- **Transactional insert** — a DB write wrapped in a Postgres transaction with an advisory lock on `restaurant_id`, preventing double-bookings.
- **Idempotency key** — see PRD §18.
- **On-demand revalidation** — Next.js's mechanism for marking a cached page stale immediately (instead of waiting for the TTL).

---

End of document.
