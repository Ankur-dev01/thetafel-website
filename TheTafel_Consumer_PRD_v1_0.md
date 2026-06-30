# The Tafel — Product Requirements Document
## Part 2 of 3 — Consumer-Facing Surfaces

**Document:** TheTafel_Consumer_PRD_v1.0
**Scope:** Public-facing guest experience — reservation booking page, QR-at-table ordering, takeaway ordering (Netherlands first, EU-ready)
**Status:** Source of truth. Replaces all earlier booking / ordering specifications including OTS_Booking_System_PRD_v3.0.
**Companion files:**
- `TheTafel_Consumer_BuildPlan_v1.0.md` — phased delivery plan with steps and sub-steps
- `TheTafel_Consumer_Schema_v1.0.sql` — full database schema additions referenced throughout

---

## 0. How to read this document — and how Claude must work with it

### 0.1 What this document is

This PRD specifies every consumer-facing screen and server behaviour for The Tafel's three guest services. It does **not** contain the build plan (separate file) or the SQL schema (separate file). It does not cover the restaurant dashboard (Part 3) or the onboarding flow (Part 1, already shipped).

### 0.2 Section map

- §1 Product overview, scope, brand, the three flows at a glance.
- §2 Architecture decisions made up front so they cannot drift — routing, caching, real-time, anonymous guests.
- §3 The three guest flows end to end, narrative form.
- §4 Reservation booking page, screen by screen.
- §5 QR ordering, screen by screen.
- §6 Takeaway ordering, screen by screen.
- §7 Database schema additions, high-level.
- §8 Security model and abuse prevention.
- §9 Payments — Mollie Connect for Platforms, all three flows.
- §10 Notifications — Resend email, WhatsApp Business Cloud API.
- §11 Performance and operational targets.
- §12 GDPR, consent, retention.
- §13 Patterns from Phase 1 that **must** be applied here.
- §14 Anti-patterns from Phase 1 that **must not** be repeated.
- §15 How Claude must respond during this build phase.
- §16 Out of scope — boundary with Part 3.
- §17 Future updates designed for but not built now.
- §18 Glossary.

### 0.3 How Claude must respond during Phase 2 work

Every interaction in the Phase 2 build follows these rules. They are not suggestions.

**Read the code before proposing any fix.** The single most expensive lesson from Phase 1 was Claude pattern-matching to common Next.js issues instead of opening the actual file. If a bug recurs after one "fix," the root cause is somewhere else. Open the source. Trace it.

**Plain English. No buzzwords. No fluff.** The user is non-technical. Explain technical terms when they appear ("RLS means row-level security — each restaurant only sees its own data"). No "leveraging synergies," no "robust solutions," no "best-in-class."

**Brief replies.** No multi-paragraph preambles. No restating context the user already provided. No echoing back acknowledgments. If a confirmation is needed, give it in one line. Voice input is common — interpret typos charitably without comment.

**One logical unit at a time.** Wait for the user's confirmation before moving on. Don't batch multiple changes.

**Code delivered as downloadable Markdown prompt files.** Never inline chat code blocks for build work. Files written to `/home/claude/prompts/` and presented via `present_files`. The user pastes them into Claude Code CLI.

**Every prompt file starts with a plain-English summary** explaining what the change does and why, before any code.

**Push to git push origin main after every successful unit.** Build must stay green. Manually verify with `git log --oneline -3` — Claude Code occasionally reports phantom pushes.

**Use the Supabase MCP for all DB operations.** Always pass `project_id: ipjzrprddlsxjsiiozgh` explicitly. Never touch the legacy project `aszgirjrxvuoojlnsefb`.

**Use the Vercel MCP for log inspection.** Broad queries (only `since` and `limit`) are more reliable than filtered ones — the `statusCode` and `source` filters frequently miss API route errors.

**Save the user's tokens.** Don't re-explain context the user just gave. Don't pad answers with disclaimers. Combine related small steps into single prompts where they share a file or a coherent concern — but never bundle unrelated work.

**Security is not an afterthought.** Every endpoint, every form, every payment flow gets reviewed against §8 before shipping. No exceptions.

**Future updates are designed for now.** No painted-into-a-corner schemas. No hard-coded NL-only assumptions where EN already needs to work. Add forward-compatibility seams in §17 before they hurt.

---

## 1. Product overview

### 1.1 What Phase 2 builds

Phase 2 is the moment The Tafel starts earning. A restaurant that finishes onboarding (Phase 1) needs three things to actually transact:

1. A **public reservation booking page** where guests pick a date, time, and party size, leave their details, optionally pay a deposit, and receive a confirmation.
2. A **QR-at-table ordering page** that opens when a guest scans a table sticker. They browse the menu, add items, pay, and the order lands in the restaurant's kitchen view.
3. A **takeaway ordering page** where guests browse the menu, choose a pickup time, pay upfront, and receive a confirmation with the pickup time and code.

All three pages live on `thetafel.nl` under each restaurant's slug. They are public, mobile-first (especially QR), and work for anonymous guests without any login.

### 1.2 What is explicitly out of scope for Phase 2

- The restaurant operations dashboard (Phase 3) — settings changes, analytics, manual booking edits, marketing.
- A native mobile app — the consumer flows are web only.
- Delivery — the `service_delivery_enabled` flag stays `false`; flow not built.
- Multi-restaurant marketplace browsing (Phase 4) — guests reach a restaurant via a direct link, a QR code, or a search-the-restaurant page on the marketing site.
- Loyalty programmes, gift cards, group bookings of 12+, private events, prix-fixe menu builders, vendor catalog APIs — all Phase 4+.
- Native iOS/Android apps.

### 1.3 The three flows at a glance

| Flow | Where it starts | Auth | Money in | Output |
|---|---|---|---|---|
| Reservation | `/r/[slug]/book` or a Tafel marketplace link | No | Optional deposit (Mollie connected) | Confirmed booking row + email/WhatsApp confirmation |
| QR ordering | Phone scans a table sticker → opens `/r/[slug]/qr/[tableId]` | No | Order total (Mollie connected) | Order row in kitchen view + guest "we're cooking" status |
| Takeaway | `/r/[slug]/order` (direct or from marketing site) | No | Order total upfront | Order row + pickup-time confirmation + ready notification |

### 1.4 Brand consistency with Phase 1

All visual rules from Phase 1 apply unchanged:
- Raleway 900 display, Jost 300–700 body
- Amber `#d4820a` accent, cream `#fdfaf5` background, dark `#0f0d08` text
- No icon library (Phosphor adopted in Phase 1 UI polish — same here)
- No stock photography of smiling people with forks, no AI-generated imagery
- No gradients, no pure black/white, no buzzwords, no exclamation marks
- Custom inline SVG icons drawn by hand where Phosphor doesn't fit

The consumer surfaces feel like the restaurant's site, with a discreet "Booking by The Tafel" footer line.

### 1.5 What "good UX" means on the consumer side

Different from the onboarding side. The guest is not a customer of The Tafel — the guest is the restaurant's customer who happens to be using our software. Implications:

- The restaurant's brand should be visible (its name, its colours within constraint, its photography if it provides any). The Tafel itself stays understated.
- Friction kills conversion. Every required field, every captcha, every confirmation modal needs justification.
- The guest is likely on a phone. Design mobile-first; tablet and desktop adapt.
- Slow pages lose bookings. Performance targets in §11 are hard floors.
- Confidence matters. A guest who paid a deposit needs to see the deposit confirmed clearly, with refund terms in plain Dutch.

---

## 2. Architectural foundations

These decisions are made once and do not drift through the build. Every later choice references them.

### 2.1 Multi-tenant routing model

**Decision: path-based.** Each restaurant is reached at `https://thetafel.nl/r/[slug]/...`. Examples:

- `/r/de-zwarte-zwaan/book` — reservation
- `/r/de-zwarte-zwaan/qr/T12` — QR landing for table T12
- `/r/de-zwarte-zwaan/order` — takeaway

The `slug` is set during onboarding (auto-generated as `draft-{uuid}` if not customised, replaced with the restaurant's chosen handle later). Slugs are unique, lowercase, hyphen-separated, 4–48 chars.

Subdomains (`de-zwarte-zwaan.thetafel.nl`) are deliberately rejected for Phase 2 — they multiply SSL cert complexity, break local development, and provide no isolation that RLS doesn't already give. If white-label sells in Phase 4, custom domains via Vercel's domain product become an upgrade.

### 2.2 Public page rendering and caching

**Decision: Incremental Static Regeneration (ISR) with on-demand invalidation, behind a server-component-rendered shell.**

Each restaurant landing (`/r/[slug]/...`) is statically generated at first request, then cached with a 60-second revalidation. When the restaurant updates relevant data (menu, opening hours, no-show rules) in Phase 3, an `invalidateConsumerPage(slug)` helper fires `revalidatePath('/r/[slug]')` + the same with `/en/` prefix.

The booking-step pages themselves (date picker, party size, etc.) are client components that fetch live availability via API routes. Only the restaurant chrome (name, photo, hours summary, about copy) is statically rendered.

This avoids two bad outcomes:
1. Fully dynamic pages on every guest visit — slow, expensive.
2. Stale pages where a menu update doesn't appear for an hour — embarrassing.

### 2.3 Real-time table availability

**Decision: optimistic locking on booking submit. No polling. No websockets in Phase 2.**

When a guest views available slots, the client fetches a snapshot from `/api/v1/public/[slug]/availability?date=YYYY-MM-DD`. This snapshot is good for as long as the guest takes to finish the form. On submit, the booking insert runs inside a transaction that:

1. Acquires a Postgres advisory lock on the restaurant ID
2. Re-checks availability for the requested slot
3. Either inserts the booking or returns a `slot_taken` error
4. Releases the lock

If `slot_taken`, the client shows "Sorry — someone just took that table. Here are the closest available times." with three near alternatives.

Supabase Realtime is rejected for Phase 2 because: it adds client complexity for a problem that affects <1% of bookings at expected volumes, websockets are a meaningful cold-start cost, and the user-perceived value is low (most guests browse for seconds, not minutes).

If contention becomes real in Phase 3+, Realtime can be added incrementally without schema changes.

### 2.4 Anonymous guest data model

**Decision: anonymous-first, account-optional.**

A guest books or orders with name, email, phone. No account is created. The data lives in `guests` (one row per unique email+phone combination, deduplicated server-side) and is linked to the `bookings`/`orders` row.

In Phase 3+ the restaurant dashboard's CRM view groups guest activity by `email_lower` + `phone_normalised`. A magic-link "log in to see your bookings" page is a Phase 3 follow-up.

PII is minimised: no birthday, no address (unless takeaway requires it, which it doesn't — pickup), no marketing opt-in until explicitly checked. Newsletter opt-in is a footer checkbox, default off.

### 2.5 Multi-language

NL default, EN at `/en/r/[slug]/...`. The same next-intl setup as Phase 1.

All restaurant-authored content (menu names, descriptions, about text) is stored once. If the restaurant wants both languages, they fill both during onboarding/dashboard; if only one, that language renders for both URL prefixes (with no toggle artifact).

Restaurant content gets a `content_locale` field per row indicating the source language. Phase 4 may add machine translation for restaurants that only fill one side.

### 2.6 Mobile-first

QR is phone-only by definition. Reservation and takeaway are designed mobile-first with desktop as the responsive case.

Breakpoints:
- `< 640px` — single column, full-width controls, sticky bottom CTA
- `640–1024px` — comfortable single column, max-width 540px
- `≥ 1024px` — two-column layout where it improves clarity (menu list left, cart right)

No "please use desktop" warnings anywhere on consumer surfaces.

### 2.7 Forward-compatible decisions

Decisions made now that prevent future pain:

- **Order state machine extensible.** `orders.status` is a Postgres enum but adding values is a single migration. States ship as `pending`, `confirmed`, `preparing`, `ready`, `completed`, `cancelled`, `refunded`. Future states (`disputed`, `partially_refunded`, `delivery_*` for Phase 4 delivery) slot in without breaking history.
- **Bookings extensible to multi-table.** A booking can already reference multiple tables via a join table `booking_tables` (M:N). Single-table bookings just insert one row. Group bookings, splits, and merges in Phase 4 use the same shape.
- **Payment intents abstracted.** All three flows write a `payment_intents` row before talking to Mollie, with the Mollie ID stored alongside. Switching providers in the future (or supporting multiple) only requires a new adapter, not a schema rewrite.
- **Menu items support modifiers.** Each `menu_item` has a `modifiers` JSONB column for variants (size, sauce, extra). Phase 2 ships without surfacing modifiers in the UI; Phase 4 adds the picker. The data shape is settled now.
- **Currency is stored explicitly.** Every monetary column has a paired `currency` field defaulting to `'EUR'`. Phase 4+ multi-currency doesn't need a migration.

---

## 3. The three guest flows — narrative

This section walks each flow in plain English so the next sections (§4–§6) can reference the steps by name. No screen-level detail here.

### 3.1 Reservation flow

A guest arrives via a direct link, the marketing site's restaurant search, or a Tafel marketplace listing (Phase 4). They land on `/r/[slug]/book`.

**Step R0 — Restaurant header.** Restaurant name, photo if available, "Reserveer een tafel" / "Book a table" heading, a one-line cuisine + neighbourhood subtitle.

**Step R1 — Date and party size.** Calendar picker (default today, max 60 days out), party-size selector (1–`max_party_size` from booking rules, default 2). Calendar greys out closed days.

**Step R2 — Time slot.** Slots for the chosen date and party size, generated server-side from opening hours, table inventory, occupancy duration, turnover buffer. Slots show as a grid of buttons in 15-minute increments. Each slot indicates capacity remaining ("3 tafels", "1 tafel" — never absolute counts beyond 5).

**Step R3 — Zone (optional).** If the restaurant has multiple zones AND the guest selects an outdoor zone like "Terras," show the zone choice as a row of pills. If only one zone, this step is skipped.

**Step R4 — Guest details.** Name, email, phone, optional note ("dieet" / "rolstoel" — kept short). NL phone format default, EN format if locale toggled.

**Step R5 — No-show protection (conditional).** If `noshow_prepaid_enabled = true` for this restaurant AND the party size meets the threshold, the guest sees a "Bevestig met aanbetaling van €X" / "Confirm with a €X deposit" step. Otherwise, skipped. Deposit pays via iDEAL primary, card secondary.

**Step R6 — Review and confirm.** Shows everything: restaurant, date, time, party size, zone, name, deposit (if any), cancellation policy. "Bevestig reservering" button. Click → server creates the booking transactionally, kicks off email + WhatsApp confirmation.

**Step R7 — Confirmation screen.** "Je tafel staat klaar" / "Your table is booked." Booking reference code (8 alphanumeric, e.g. `T9F-4XQ2`). "Add to calendar" button (ics file). "Manage booking" link (a magic-link sent to email — open it to change or cancel).

### 3.2 QR ordering flow

A guest at a table scans the QR sticker. URL: `/r/[slug]/qr/[tableId]?qr=1`.

**Step Q0 — Welcome.** Restaurant name, table label ("Tafel 12"), a one-line "Bestel direct vanaf je tafel" / "Order from your table." Language toggle. "Bekijk menu" CTA.

**Step Q1 — Menu browse.** Categories as a horizontal sticky chip bar at top. Items below as cards with name, short description, price, optional photo, allergen icons. "Item notes" (e.g. "geen ui" / "no onions") allowed if the restaurant enabled it in onboarding.

**Step Q2 — Cart.** Sticky footer button "Bekijk bestelling — €X (Y items)". Tap → cart drawer. Edit quantities or remove. "Verder bestellen" returns to menu; "Naar betaling" proceeds.

**Step Q3 — Pay choice (if both modes available).** Pay-now or pay-at-table (if `qr_pay_at_table_enabled = true`).

**Step Q4 — Pay.** If pay-now: iDEAL/card via Mollie. If pay-at-table: open tab, guest gets a ticket number, staff adds to a printed bill at end of meal. Pay-at-table requires the table to have an active "open tab" record.

**Step Q5 — Confirmation.** "Bestelling ontvangen — tafel 12" / "Order received — table 12." Order number. "Status updates komen op deze pagina aan" line. WebSocket/polling refresh — pending → preparing → ready (e.g. "drinks coming") → served.

### 3.3 Takeaway flow

Guest arrives at `/r/[slug]/order` from a direct link or the marketing site.

**Step T0 — Landing.** Restaurant header. "Bestellen voor afhalen" / "Order for pickup." Today's hours + earliest pickup slot prominently shown.

**Step T1 — Menu browse.** Same component as Q1, with takeaway-specific items if the restaurant marked any as "QR only" or "takeaway only" in their menu config.

**Step T2 — Cart.** Same as Q2.

**Step T3 — Pickup time.** Grid of available slots in 15-minute increments from `now + min_lead_time_minutes` through closing time. Generated server-side from opening hours, kitchen capacity (number of orders allowed per slot), and current backlog.

**Step T4 — Guest details.** Name, email, phone. Optional company name for business pickups. Note field.

**Step T5 — Pay.** Mandatory upfront payment via Mollie. iDEAL primary, card secondary.

**Step T6 — Confirmation.** "Je bestelling is bevestigd voor 19:30" / "Your order is confirmed for 19:30." Pickup code (e.g. `PU-92X`). "Bewaar deze code voor afhalen." Email + WhatsApp confirmation. Optional "Voeg aan agenda toe" calendar invite.

A second notification fires when staff marks the order ready ("Je bestelling is klaar om af te halen — tot zo!").

### 3.4 Cross-cutting concerns

- **Guest identity.** Each (email_lower, phone_normalised) pair maps to one `guests` row, lazily created.
- **Notifications.** Resend (email) and WhatsApp Business Cloud API (WA). WA requires the restaurant to have completed Meta business verification — restaurants without it get email only.
- **Cancellation/modification.** Magic-link sent at booking time; opening it goes to a "Manage booking" page where the guest can cancel (with refund timing depending on the cancellation policy) or request a change (sent as message to restaurant).
- **Anti-abuse.** Rate limits per IP, per (email, phone), Cloudflare Turnstile on the final submit step of each flow.

---

## 4. Reservation booking page — detailed spec

Each screen below uses the same template: **Purpose → Inputs → Validation → Server behaviour → Data → Continue criteria.**

### Step R0 — Restaurant header

**Purpose.** Establish the restaurant in the guest's mind. Reinforce trust.

**Inputs.** None (read-only).

**Display.**
- Restaurant photo (16:9, lazy-loaded, blurred placeholder). Default if absent: a clean amber wordmark on cream.
- Restaurant name in Raleway 900, 36–48px responsive.
- Subtitle: `{cuisine_type} · {neighbourhood}` in Jost 400, 14px, stone.
- Quick info row: ⏱ opening hours summary today · 📍 address (clickable, opens Google Maps) · ☎ phone (clickable on mobile to call). Icons via Phosphor.

**Server behaviour.** Page is statically generated; data fetched at build/revalidate time only.

**Data read.** `restaurants.display_name`, `restaurants.cuisine_type`, `restaurants.neighbourhood`, `restaurants.address_line1`, `restaurants.address_postcode`, `restaurants.address_city`, `restaurants.phone_public`, `restaurants.photo_url`, opening hours summary.

**Continue.** Always — this is the header.

### Step R1 — Date and party size

**Purpose.** Bracket the search.

**Inputs.**
- Date picker: month-grid calendar, NL/EN locale-aware day-of-week labels. Today highlighted; closed days greyed and unclickable. Max date = today + booking-window days (set in onboarding).
- Party-size selector: pill row (1, 2, 3, 4, 5, 6, 7, 8+), default 2. "8+" opens a small "Larger party" notice with a link to contact the restaurant directly (capacity decisions for big parties stay with the restaurant).

**Validation.**
- Date: required, must be open day, within booking window, not in past.
- Party size: required, between 1 and `max_party_size_online`. Larger parties don't proceed.

**Server behaviour.** No write yet.

**Continue criteria.** Both inputs valid.

### Step R2 — Time slot

**Purpose.** Pick the exact time.

**Inputs.** Grid of 15-min slots for the chosen date, divided into morning / lunch / dinner segments. Slots either show as "available" (amber outline button) or hidden if no capacity.

**Display.** Each slot shows the time (e.g. "19:00") and a small capacity hint when below 4 tables remaining ("3 tafels", "2 tafels", "1 tafel"). At ≥ 4, no hint shown to avoid making slots seem scarce.

**Server behaviour.** Slot list fetched from `/api/v1/public/[slug]/availability?date=YYYY-MM-DD&partySize=N`. The server computes available slots from `opening_hours`, `restaurant_tables` (capacity), `occupancy_duration_minutes`, `turnover_buffer_minutes`, and existing `bookings` for that day.

**Performance.** Endpoint must return in ≤ 200ms warm, ≤ 800ms cold (see §11). Cached behind a 30-second edge cache keyed by `(slug, date, partySize)`.

**Validation.** Slot belongs to the returned snapshot, not stale or fabricated.

**Continue criteria.** A slot selected.

### Step R3 — Zone (optional)

**Purpose.** Let the guest pick indoor/outdoor when relevant.

**Display.** Pills row for each zone. Each pill shows zone name and capacity indicator. Skipped entirely if only one zone OR if zone is implied (e.g. outdoor closed in winter).

**Validation.** Selected zone has availability at the chosen slot for the chosen party size.

**Continue criteria.** Either (a) skipped because not needed, or (b) a valid zone selected.

### Step R4 — Guest details

**Purpose.** Collect the minimum to confirm and contact.

**Inputs.**
- Full name (required, ≤ 80 chars)
- Email (required, valid format, lowercased server-side)
- Phone (required, NL format default; international format accepted)
- Note (optional, ≤ 200 chars)
- Marketing consent (optional checkbox, default unchecked): "Stuur me incidentele aanbiedingen van {restaurant_name}." Stored in `guests.marketing_consent` with timestamp.

**Validation.**
- Email: RFC 5322-light. Server confirms with a regex + DNS MX existence check at submit time.
- Phone: stored as E.164. Server normalises.
- Name: stripped of control chars, no leading/trailing whitespace.
- Note: stripped of script tags and dangerous HTML; stored as plain text.

**Server behaviour.** No write yet. Validation only.

**Continue criteria.** All required fields valid.

### Step R5 — No-show deposit (conditional)

**Purpose.** Reduce no-show risk for restaurants who opt in.

**Show when.** `noshow_prepaid_enabled = true` AND `partySize >= noshow_prepaid_threshold` AND `slot_time` falls in a window the restaurant flagged for deposit (e.g. Friday/Saturday evenings).

**Display.**
- Amount: `€ {noshow_prepaid_amount_cents/100} per persoon` × party_size = `€ X total`
- Cancellation policy plain-language: "Geen restitutie als je < 24 uur tevoren annuleert" / "No refund for cancellations under 24 hours."
- Mollie payment method picker (iDEAL primary, card secondary; one button for each)

**Server behaviour.**
- Create `payment_intent` row with `purpose='deposit'`, `amount_cents=X`, `currency='EUR'`, `status='pending'`.
- Call Mollie's connected-org Create Payment with redirect URL `/r/[slug]/book/return/[intentId]`.
- Redirect to Mollie checkout.

**On return.** Mollie redirect → server verifies payment status via Mollie API (never trusts the redirect alone). If paid, mark `payment_intent.status='paid'` and proceed to R6. If failed/cancelled, return to R5 with error message and allow retry.

**Refund behaviour.** Configured during onboarding. Default: auto-refund when staff marks booking `attended`. Auto-charge captured already; no further action needed.

### Step R6 — Review and confirm

**Purpose.** Final glance before commit.

**Display.** Vertical list of all collected values, including deposit info if paid. Plain Dutch labels. "Bevestig reservering" button.

**Server behaviour.** On click:
1. Open transaction.
2. Acquire advisory lock on `restaurant_id`.
3. Re-verify slot availability for the requested time and party.
4. Insert `guests` row (or fetch existing by email+phone).
5. Insert `bookings` row with `status='confirmed'`, link to `payment_intent` if any.
6. Generate `booking_ref` (8 chars, format `XXX-XXXX`).
7. Generate a magic-link token for the "Manage booking" page, store hashed.
8. Commit. Release lock.
9. Fire `booking.confirmed` event → triggers Resend email + WhatsApp send (if enabled).
10. Audit log entry.

**Idempotency.** The client sends an `Idempotency-Key` header (uuid generated in R4). Re-submits within 60 seconds with the same key return the existing booking_ref, not a duplicate.

**Error handling.**
- `slot_taken` → R2 with the three nearest alternatives.
- Mollie verification failed → R5 with retry.
- DB error → "Iets ging mis — probeer opnieuw" with a retry button. No detail surfaced.

### Step R7 — Confirmation screen

**Purpose.** Reassure the guest. Provide the tools they need next.

**Display.**
- Big confirmation tick in amber circle.
- Heading "Je tafel staat klaar voor {date_human}, {time}" / "Your table is booked for {date_human}, {time}."
- Booking reference in monospace pill.
- Restaurant name, address with map link, "Plan route" CTA.
- "Voeg toe aan agenda" — generates an .ics file inline.
- "Beheer reservering" — link to the magic-link URL (guest clicks → opens manage page).
- Cancellation deadline summarised plainly: "Annuleren kan tot 24 uur tevoren."
- Deposit confirmation if any.

**Server behaviour.** None (read-only render of confirmed booking).

---

## 5. QR ordering — detailed spec

### Step Q0 — Welcome

**Purpose.** Confirm the table and set expectations.

**Display.**
- Restaurant logo / wordmark
- "Tafel {table_label}" big
- "Bestel direct vanaf je tafel — betaal in de app" / "Order from your table — pay in the app"
- NL/EN toggle
- "Bekijk menu" CTA

**Server behaviour.** Validates the `tableId` belongs to the restaurant. 404 if not.

### Step Q1 — Menu browse

**Purpose.** Let the guest find items quickly.

**Display.**
- Sticky chip bar at top: one chip per category, horizontal scrollable on mobile.
- Item cards below: name (Jost 600, 16px), short description (Jost 400, 14px, stone), price (Jost 700, 16px, dark), optional photo (square, lazy-loaded), allergen icons (Phosphor: wheat, milk, peanut, etc.).
- "Add" button per card. Quantity shown if > 0.
- "Item notes" expandable per item when permitted by restaurant.

**Cart preview.** Sticky footer: "{N} items — €X" — tap opens cart.

**Server behaviour.** Menu fetched once on page load from `/api/v1/public/[slug]/menu`. Cached behind 60s edge cache. Updates propagate via on-demand revalidation when restaurant publishes menu changes in Phase 3.

### Step Q2 — Cart

**Purpose.** Confirm items before pay.

**Display.** Drawer (bottom sheet on mobile, side panel on desktop). Each item with name, quantity stepper, item notes if present, line price. Subtotal, VAT, total.

**Validation.** All items still in stock / not removed since add.

**Continue criteria.** ≥ 1 item, all valid.

### Step Q3 — Pay choice

**Show when.** Both `qr_pay_now_enabled` and `qr_pay_at_table_enabled` are true. Otherwise skipped (only one path available).

**Display.** Two cards: "Nu betalen — direct doorgeven aan keuken" / "Pay now — go straight to kitchen" and "Betalen bij vertrek — geef je bestelling door en betaal aan tafel" / "Pay at the end — order now, settle at table." The pay-now card is the default highlight.

### Step Q4 — Pay

**Pay-now path.**
- Create `payment_intent` `purpose='qr_order'` with line items.
- Create Mollie connected-org payment.
- Redirect to Mollie checkout.
- On return, verify status, mark intent paid, create `orders` row with `status='confirmed'`, push to kitchen view.

**Pay-at-table path.**
- Insert `orders` row with `status='confirmed'`, `payment_status='pending'`, link to an open `tabs` row (one per table per service shift).
- No Mollie call now. Pay collected later by staff via the dashboard, or via a "Pay now" button in this page that the guest can tap later (which then runs the pay-now flow against the open tab).

**Idempotency.** Same `Idempotency-Key` pattern as R6.

### Step Q5 — Confirmation and status

**Display.** "Bestelling ontvangen — tafel {N}" / "Order received — table {N}." Order code. Status line that updates as the kitchen marks the order through the workflow.

**Status updates.** Polled every 8 seconds for the first 10 minutes (fast feedback while order is preparing), then every 30 seconds for 30 more minutes, then page goes quiet (the order is assumed complete). No Realtime websockets in Phase 2.

**Status states surfaced to guest.** `received` → `preparing` → `ready (drinks)` / `served` / `pickup ready`. Restaurant-tagged sub-statuses Phase 3.

---

## 6. Takeaway ordering — detailed spec

### Step T0 — Landing

**Display.** Restaurant header (as R0). Heading "Bestellen voor afhalen" / "Order for pickup." Today's open hours and earliest pickup window prominent.

If closed today, render a friendly "Vandaag gesloten — eerstvolgende afhaal op {next_open_date}, {hours}" / "Closed today — next pickup on {next_open_date}, {hours}."

### Step T1 — Menu browse

Same as Q1. Items can be flagged "takeaway only" or "QR only" in the menu config; the consumer page only shows items applicable to that context.

### Step T2 — Cart

Same as Q2.

### Step T3 — Pickup time

**Purpose.** Pick when the guest will arrive.

**Display.** Grid of 15-minute slots from `now + min_lead_time_minutes` through closing, with kitchen capacity respected (slot greyed if full).

**Validation.** Slot is in the future, restaurant open, capacity available at submit time.

### Step T4 — Guest details

**Purpose.** Identify the guest for pickup verification.

**Inputs.** Full name, email, phone (E.164), optional company name for business pickups, optional note.

**Validation.** Same as R4.

### Step T5 — Pay (mandatory)

**Server behaviour.** Create `payment_intent` `purpose='takeaway_order'`, Mollie call, redirect. Identical pattern to R5 and Q4 pay-now.

### Step T6 — Confirmation

**Display.**
- Big confirmation tick.
- "Je bestelling is bevestigd voor {pickup_time}" / "Your order is confirmed for {pickup_time}."
- Pickup code (e.g. `PU-92X`) prominently.
- "Bewaar deze code om af te halen" / "Save this code for pickup."
- Restaurant address, map link, "Plan route."
- Email + WhatsApp confirmation triggered.

**Ready notification.** When restaurant staff marks the order `ready` in the dashboard (Phase 3), a second WhatsApp + email fires: "Je bestelling is klaar! — tot zo." The order's `ready_notified_at` is set so duplicate sends don't fire.

---

## 7. Database schema additions — high level

Full DDL in `TheTafel_Consumer_Schema_v1.0.sql`. The summary:

### 7.1 New tables

- `guests` — anonymous guest dedupe (email_lower, phone_normalised, marketing_consent, etc.)
- `bookings` — reservations (restaurant_id, guest_id, slot_time, party_size, zone_id, status, booking_ref, deposit_payment_intent_id, magic_link_token_hash, etc.)
- `booking_tables` — M:N booking ↔ tables (always one row in Phase 2, ready for multi-table in Phase 4)
- `orders` — QR + takeaway orders (restaurant_id, guest_id, table_id nullable, type enum 'qr'/'takeaway', status, payment_status, payment_intent_id, total_cents, pickup_time nullable, etc.)
- `order_items` — line items per order (order_id, menu_item_id, quantity, unit_price_cents, item_notes, modifiers JSONB)
- `tabs` — open tabs per table per shift (restaurant_id, table_id, opened_at, closed_at, total_cents, status)
- `payment_intents` — abstraction over Mollie (restaurant_id, purpose enum, amount_cents, currency, status, mollie_payment_id, idempotency_key)
- `menus`, `menu_categories`, `menu_items` — restaurant menu hierarchy (some of these may already exist from Phase 1's menu upload step — schema file reconciles)
- `magic_links` — short-lived tokens for booking/order management URLs (token_hash, purpose, expires_at, consumed_at)
- `consumer_audit_logs` — every state change on bookings and orders

### 7.2 New columns on existing tables

- `restaurants` — `noshow_prepaid_enabled`, `noshow_prepaid_threshold`, `noshow_prepaid_amount_cents`, `noshow_prepaid_window` (JSONB describing day/time windows), `qr_pay_now_enabled`, `qr_pay_at_table_enabled`, `min_lead_time_minutes`, `max_party_size_online`, `booking_window_days`, `photo_url`, `neighbourhood`, `phone_public`, `address_*`. (Several of these are already in place from onboarding — schema file deduplicates.)

### 7.3 Enums

- `booking_status` — `pending`, `confirmed`, `cancelled`, `attended`, `no_show`
- `order_status` — `pending`, `confirmed`, `preparing`, `ready`, `served`, `completed`, `cancelled`, `refunded`
- `payment_intent_status` — `pending`, `paid`, `failed`, `cancelled`, `refunded`, `partially_refunded`
- `payment_intent_purpose` — `deposit`, `qr_order`, `takeaway_order`, `subscription`, `qr_setup_fee`
- `order_type` — `qr`, `takeaway`

### 7.4 RLS policies summary

Every new table has RLS enabled by default. Policies summarised:

- Public read for `restaurants`, `menus`, `menu_categories`, `menu_items` where `status='live'` and the row is published.
- No public read on `bookings`, `orders`, `guests`, `payment_intents` — these are accessed only by:
  - The owning restaurant via authenticated session
  - The booking/order owner via magic-link service-role lookup
  - Internal API routes via service role
- All write policies on consumer tables restricted to service-role API routes (no direct client writes).

---

## 8. Security model and abuse prevention

This is non-negotiable. Every endpoint and form must clear this section before merging.

### 8.1 Public API design

**Every public endpoint is read-only or requires server-side validation.** Examples:

- `GET /api/v1/public/[slug]/availability` — read, rate-limited per IP
- `POST /api/v1/public/[slug]/book` — write, idempotency-keyed, captcha-gated, rate-limited per IP and per (email, phone)
- `POST /api/v1/public/[slug]/order` — write, same protections

Client code never inserts into the database directly. All writes go through `/api/v1/public/...` routes that:

1. Validate the payload server-side (zod schemas)
2. Re-fetch authoritative data (slot availability, menu prices) — do not trust client-sent prices
3. Apply rate limits
4. Verify CAPTCHA token on submit
5. Use service-role client only inside the route handler
6. Write to DB

### 8.2 Rate limits (Upstash Redis)

- `GET availability` — 60 requests per IP per minute
- `POST book` — 5 per IP per hour AND 3 per (email, phone) per hour
- `POST order` — 10 per IP per hour AND 5 per (email, phone) per hour
- `POST cancel-booking` — 10 per IP per hour
- Mollie return-URL handler — 20 per IP per minute (Mollie may retry)

Burst above limit returns 429 with `Retry-After` header. UI shows "Een moment — te veel aanvragen tegelijk."

### 8.3 CAPTCHA

Cloudflare Turnstile (free, privacy-respecting) on the final submit step of each flow (R6, Q4, T5). Score-based; only blocks on high-confidence bot signals. Falls back to checkbox challenge if needed.

Server verifies the Turnstile token via Cloudflare's verification endpoint before accepting the write.

### 8.4 PII handling

- Email stored as plain text (required for sending), but indexed on lowercased version for case-insensitive matching.
- Phone normalised to E.164 server-side.
- No payment card data ever touches our database. Mollie hosts the card form; we store only the Mollie payment ID.
- Magic-link tokens stored as SHA-256 hashes, never plaintext. Tokens are 32-byte random, base64url-encoded.
- All PII columns are listed in `gdpr_pii_columns.sql` for the data-export tool.

### 8.5 Payment security

- All Mollie API calls server-side only.
- Mollie API key, webhook secrets, and connected-org tokens in environment variables.
- Mollie webhook handler verifies HMAC signature (when Mollie ships signed webhooks Phase 2 partway; current next-gen webhooks landed mid-Phase-1).
- Payment redirect from Mollie never trusted — always re-fetch payment status via Mollie API on return.
- Refunds initiated only through internal admin or scheduled jobs, never from client.

### 8.6 CSP, headers, CSRF

- Strict Content-Security-Policy with nonces on scripts. No inline scripts except where nonced.
- `Strict-Transport-Security` with preload.
- `X-Frame-Options: DENY` to block clickjacking.
- `Referrer-Policy: strict-origin-when-cross-origin`.
- CSRF: SameSite=Strict cookies + double-submit token on all POST routes via Next.js built-in protection.
- Headers configured in `proxy.ts` middleware so they apply uniformly.

### 8.7 Magic-link security

- Token TTL: 30 days for booking management, 7 days for order tracking.
- One-time consumable for sensitive actions (cancellation) — token rotated after consume.
- Read actions (view booking) reusable but logged.
- All consumption logged in `consumer_audit_logs`.

### 8.8 Input sanitisation

- Plain text fields: strip control chars, NFKC-normalise unicode, length-limit.
- HTML never allowed in user input. If we render restaurant-authored content with rich text, that comes from the dashboard (Phase 3) and is sanitised through a strict allowlist.
- File uploads: only menu photos (Phase 3 dashboard), strict mime + size + content-type sniff via `file-type` library, processed through `sharp`, stripped of EXIF.

### 8.9 Threat model checklist

For every new public endpoint, the implementing engineer answers:

1. What's the worst-case payload? Tested with fuzz inputs?
2. Can this be replay-attacked? Idempotency key required?
3. Is this rate-limited? At what dimension (IP, email, phone)?
4. Does this expose any user enumeration (e.g. "this email already booked")? If yes, can it be avoided without breaking UX?
5. Does this need CAPTCHA?
6. Are all DB writes inside a transaction? Are race conditions guarded with advisory locks?
7. Are all error messages safe (no DB schema hints, no stack traces)?
8. Is the audit log entry deterministic and complete?

This list goes in code review for every PR touching consumer endpoints.

---

## 9. Payments — Mollie Connect for Platforms

### 9.1 Account architecture (carried from Phase 1)

- **Platform account** — Anthropic-owned, handles restaurant-to-Tafel subscription billing.
- **Connected org accounts** — one per restaurant, KYC'd, handles all guest-to-restaurant money flows (deposits, QR orders, takeaway). Restaurant authorises us via OAuth during onboarding step 11.

All Phase 2 payments use the **connected org account** for the relevant restaurant. The platform takes a small commission only on marketplace-driven bookings (Phase 4 future); Phase 2 transactions all flow restaurant ← guest with the restaurant's connected account as the merchant of record.

### 9.2 Payment intent lifecycle

1. Client submits final step (R6 / Q4 / T5).
2. Server validates payload, creates `payment_intents` row with `status='pending'` and `mollie_payment_id=NULL`.
3. Server calls Mollie Create Payment via the restaurant's connected org token. Stores returned Mollie ID + checkout URL.
4. Server redirects browser to Mollie checkout URL.
5. Guest pays via iDEAL or card.
6. Mollie redirects back to `/r/[slug]/return/[intentId]`.
7. Server fetches Mollie payment status authoritatively. Updates `payment_intents.status`. If paid, creates the booking/order row inside a transaction.
8. Mollie webhook also fires asynchronously. Webhook handler is idempotent — same payment update applied twice is a no-op.

### 9.3 Refunds

- Booking cancellation outside policy window → automatic refund via Mollie API. `payment_intent.status` → `refunded`. Audit logged.
- Inside policy window → no refund. Guest sees policy at cancellation time.
- Restaurant-initiated refunds (Phase 3 dashboard) → audit logged with reason code.
- Partial refunds (e.g. one item out of stock on takeaway) → Phase 3 dashboard feature. Phase 2 supports full refund only via API.

### 9.4 Payment methods

- iDEAL primary in NL (default selected)
- Card secondary (Visa, Mastercard)
- Bancontact for BE expansion (Phase 4)
- SEPA Direct Debit for subscription only, not consumer payments (one-shot SDD has high failure)
- Apple Pay / Google Pay (Phase 3+, via Mollie when ready)

### 9.5 Test mode

- Mollie test API key in non-prod environments
- `MOLLIE_DEV_BYPASS_WEBHOOK_SIGNATURE=true` env var for local dev only (set false in prod, build fails if it's true in prod env vars at deploy)
- Test SEPA Direct Debit is unreliable per Phase 1 — use the dev-only credit card override path also in Phase 2 for end-to-end QA

---

## 10. Notifications

### 10.1 Email — Resend

- Sender: `hallo@thetafel.nl`
- Domain `thetafel.nl` verified, custom SMTP in Supabase Auth
- All transactional emails use React Email templates compiled to static HTML
- Inline images via CID attachments (Gmail blocks `data:` URLs per Phase 1)
- Each restaurant gets per-event templates: booking confirmed, booking cancelled, order confirmed, order ready, deposit captured, deposit refunded
- Restaurant-branded header (name, logo if uploaded, accent colour respecting brand)
- Plain-text fallback for every HTML email
- Unsubscribe link required for marketing emails only; transactional emails are exempt under Dutch / GDPR rules but include a polite "Why am I getting this" footnote

### 10.2 WhatsApp Business Cloud API

- Required for the `WhatsApp reminders & confirmations` Premium feature (and any tier that adds it via opt-in)
- Meta Business Verification required per restaurant
- Restaurants without verification get email only — Phase 2 must gracefully degrade
- Pre-approved message templates: booking_confirmed, booking_reminder_24h, booking_reminder_2h, order_received, order_ready, deposit_refunded
- Templates stored as Meta-approved structures; substitution variables typed
- Send via the platform's WhatsApp API key, with the restaurant's verified phone number as the `from`
- Failed sends fall back to email automatically; both attempts logged

### 10.3 SMS

Not in Phase 2. WhatsApp covers the same need at lower cost; SMS comes in Phase 4 only if a customer demands it.

### 10.4 In-app status updates

QR ordering page polls for status updates per §5 step Q5. Not technically a notification — included here for completeness.

---

## 11. Performance, operational

### 11.1 Page load targets (production, p75)

- Restaurant header (R0/T0) Time-to-First-Byte: ≤ 400ms
- Restaurant header Largest Contentful Paint: ≤ 1.8s
- Availability fetch (R2): ≤ 200ms warm, ≤ 800ms cold
- Booking submit (R6): ≤ 800ms server work + Mollie redirect time
- Menu fetch (Q1/T1): ≤ 400ms warm

Measured via Vercel Analytics + custom timing headers on the API routes.

### 11.2 Caching layers

- Vercel edge cache: 30s for availability snapshots, 60s for menu data
- Supabase: connection pooled via PgBouncer; statement-level caching not used (price/menu data already cached upstream)
- Upstash Redis: rate-limit counters, KVK lookup cache (carried from Phase 1)
- Browser: `Cache-Control: private, max-age=0, must-revalidate` on dynamic API responses; `Cache-Control: public, max-age=60, s-maxage=300` on menu and availability

### 11.3 Query patterns

- Availability query (most-hit endpoint) — single query joining `bookings`, `restaurant_tables`, `opening_hours` with a slot-generation CTE. Plan reviewed for sequential scans before deploy.
- Menu fetch — single query with deep join to `menu_categories` and `menu_items`. Indexed by `restaurant_id` + `published`.
- Bookings insert — transactional with advisory lock on `restaurant_id`, indexed lookup on existing bookings for the day.

### 11.4 Cold start budget

Each Vercel function should be < 5MB bundle. Hot paths (availability, menu, book) reviewed individually. `opentype.js` and `sharp` only imported by their specific routes (QR rendering, image processing) — never bundled with public pages.

### 11.5 Monitoring

- Vercel runtime logs for all API routes
- Custom error events in `consumer_audit_logs` for booking/order failures
- Mollie webhook delivery monitored — alerts on missed/failed webhooks
- Daily summary of booking/order/refund counts emailed to `hallo@thetafel.nl`

### 11.6 Backups, disaster recovery

- Supabase daily backups retained 7 days (Free tier); upgrade to Pro for longer retention before scaling
- Critical exports (bookings, orders, payments) replicated daily to encrypted S3 bucket (Phase 3+ once volumes warrant)
- Database can be restored from any daily snapshot within 30 min RTO

---

## 12. GDPR, legal, consent

### 12.1 Lawful basis

- Booking and order data: **contract performance** (Art. 6(1)(b)) — required to fulfil the booking.
- Marketing emails: **explicit consent** (Art. 6(1)(a)) — opt-in checkbox.
- Audit logs: **legitimate interest** (Art. 6(1)(f)) — fraud prevention, dispute resolution.
- Restaurant data: **contract** with the restaurant.

### 12.2 Data minimisation

- Booking requires only name, email, phone. No address, no birthday, no marital status.
- Takeaway requires same. No card details stored on our side.
- QR ordering requires no PII unless the guest opts in to "save my details for next time" (Phase 3 feature).

### 12.3 Data retention

- Bookings: 7 years (Dutch tax / consumer-protection requirement)
- Orders: 7 years
- Audit logs: 7 years
- Marketing consent + email: until withdrawal + 1 year
- Magic-link tokens: 30 days after expiry, then deleted
- Anonymous analytics (Plausible): retained per Plausible's terms (no PII)

### 12.4 Subject rights

- **Access:** Guest can request a copy of their data via a form on `thetafel.nl/privacy`. Fulfilled within 30 days. Phase 3 dashboard has a tool to export per-guest data automatically.
- **Erasure:** Request via same form. Subject to retention obligations (tax records cannot be erased before 7 years). Personal identifiers redacted but transactional records retained pseudonymised.
- **Portability:** JSON export of bookings and orders attached to access requests.
- **Rectification:** Magic-link manage page allows guest to correct their own contact details.

### 12.5 Sub-processors

- Supabase (DB hosting, EU)
- Vercel (compute hosting, EU edge)
- Resend (email)
- Mollie (payments)
- Cloudflare (Turnstile only)
- Meta (WhatsApp Business — only when restaurant enables)

All listed in the public Privacy Policy and the per-restaurant Verwerkersovereenkomst (signed during onboarding).

### 12.6 Cookies and consent banner

Phase 2 ships with a minimal consent banner showing only when non-essential cookies are present. Strict-necessary cookies (session, CSRF, language preference) don't require consent. Plausible (cookie-less by default) doesn't trigger the banner.

The banner offers Accept / Reject / Settings. Defaults conservatively to rejected; user must opt in to non-essential.

---

## 13. Patterns from Phase 1 — must apply

These were paid for in bugs. They are not optional in Phase 2.

### 13.1 Cache invalidation, both layers

Server route after a write that affects a guest-visible page:

```ts
invalidateConsumerPage(slug)  // helper in lib/consumer/cache.ts
// calls:
//   revalidatePath(`/r/${slug}`)
//   revalidatePath(`/en/r/${slug}`)
//   revalidateTag(`restaurant-${restaurantId}-menu`) if menu changed
```

Client handler after a submit that stays on the page:

```ts
saveNow(...)
startTransition(() => router.refresh())
```

`useRouter` always from `next/navigation`, NOT `@/i18n/routing` — next-intl's router doesn't expose `refresh()` the same way.

### 13.2 Visual click feedback + hover prefetch

Sidebar / step navigation (R1 → R2 → … or menu category chips) uses:

- `prefetch={false}` on the Link
- `onMouseEnter` / `onFocus` / `onTouchStart` handlers that call `router.prefetch(href)`
- Optimistic local state for the active highlight, reconciled with `pathname` after navigation

Same on the language toggle.

### 13.3 Monotonic state writes

Any column that represents "furthest progress" (e.g. an order's status going pending → confirmed → preparing) is updated with `LEAST/GREATEST` semantics. A late webhook can't move state backwards. Specifically: `payment_intents.status` never moves out of a terminal state (`paid`, `refunded`, `failed`, `cancelled`); transitions are guarded with a CHECK constraint.

### 13.4 In-place refresh wrapped in startTransition

Any client autosave (e.g. cart-quantity adjustment) calls `router.refresh()` only inside `startTransition` to avoid blank-screen flicker.

### 13.5 Mutation doorman pattern

`assertConsumerWriteAllowed(restaurant, action)` in `lib/consumer/guards.ts`:

- Blocks all writes if `restaurant.status !== 'live'`
- Blocks booking writes if `service_reservations_enabled = false`
- Blocks QR writes if `service_qr_enabled = false`
- Blocks takeaway writes if `service_takeaway_enabled = false`
- Returns structured `409 service_unavailable` on violation, never silently fails

Applied to every consumer write route.

### 13.6 Treat the live DB as the source of truth

If the migration files and the live DB schema disagree, the live DB wins. Always inspect via Supabase MCP before assuming a column shape.

### 13.7 Always pass `project_id` on every Supabase MCP call

Never touch the legacy project. Hardcode `ipjzrprddlsxjsiiozgh` in every call.

### 13.8 Bundle fonts that render server-side

Any text rendered server-side into SVG/PNG (QR cards, future receipt PDFs) bundles the TTF and converts text via opentype. Vercel runtime has no fonts.

### 13.9 Audit log helper, used everywhere

A single helper `auditLog(restaurantId, eventType, eventData)` writes to `consumer_audit_logs`. Used for every booking state change, every order state change, every refund, every cancellation, every magic-link consumption.

---

## 14. Anti-patterns from Phase 1 — must NOT repeat

### 14.1 Do not pattern-match to common Next.js bugs

When something breaks, **read the actual code** before proposing fixes. The fix-by-guessing cycle costs days. If a fix doesn't resolve the bug, the root cause is elsewhere — open the source and trace.

### 14.2 Do not duplicate redirect logic across layers

The OnboardingShell once had a resume-redirect that fought `router.refresh`. Don't reproduce this pattern. Redirect logic lives in ONE place per concern (login destination → `resolveDestination.ts`; status-based redirects → middleware or layout, never both).

### 14.3 Do not use `@supabase/ssr` createServerClient for admin operations

It does not bypass RLS. Admin server clients use `@supabase/supabase-js`'s `createClient` with `persistSession: false`. Required for any consumer route that needs to bypass RLS (most public endpoints with service-role logic).

### 14.4 Do not delete storage via SQL

`storage.protect_delete()` trigger blocks SQL deletes on `storage.objects`. Use the Storage API.

### 14.5 Do not auto-prefetch every Link in dense lists

Menu category chips, slot grids, etc. — do not let Next.js auto-prefetch all of them. Use `prefetch={false}` + hover prefetch as in §13.2.

### 14.6 Do not put `dynamic = 'force-static'` on the `[locale]` segment

Without `generateStaticParams`, this causes silent 404s. Either use `force-dynamic` or supply `generateStaticParams`.

### 14.7 Do not store sensitive data in URL parameters

No PII in query strings. Magic-link tokens are the exception — they're short-lived, hashed in DB, single-use for sensitive actions.

### 14.8 Do not trust client-sent prices

Re-fetch from `menu_items.price_cents` server-side at order time. Same for booking deposit amounts. The client-sent value is for UI only.

### 14.9 Do not over-batch multi-statement SQL via Supabase MCP

Multi-statement batches sometimes return only the last result set. Use single statements with subqueries for related checks.

### 14.10 Do not skip writing audit logs because the action seems trivial

Every state change gets logged. The cost is negligible; the value at dispute / debugging time is high.

### 14.11 Do not promise features the product doesn't have

Subscription page Phase 1 listed some features that needed honest-claim review. Same rule in Phase 2: don't add "QR ordering with AI menu suggestions" or anything aspirational in the consumer-facing copy. Marketing speaks to capability, the PRD speaks to reality.

### 14.12 Do not let the Vercel Redeploy button substitute for a real `git push`

Redeploy rebuilds the same commit. After every change, `git push origin main` + verify with `git log --oneline -3`. Never skip the verify.

---

## 15. How Claude must respond during Phase 2 work

(This expands §0.3 with build-specific behaviour.)

### 15.1 Working rhythm

- One prompt file per logical unit. Wait for user confirmation before moving on.
- Each prompt file lives in `/home/claude/prompts/` and is presented via `present_files`.
- Each prompt starts with a plain-English summary explaining what the change does.
- Prompts are paste-ready into Claude Code CLI — full files, no snippets, no "fill in the rest yourself."

### 15.2 Combining steps

Two small related changes share a prompt only if they touch the same file or the same coherent concern. Unrelated work always splits. Examples:

- Same prompt: "Add Turnstile verification to the booking submit endpoint" + "Add Turnstile widget to the R6 confirm step" (one feature, two files).
- Different prompts: "Add WhatsApp confirmation send on booking confirmed" + "Add slot capacity tooltip on R2 grid" (unrelated).

### 15.3 MCP usage

- **Supabase MCP** is the source of truth for live DB state. Use it to inspect schema, query data, apply migrations. Always `project_id: ipjzrprddlsxjsiiozgh`.
- **Vercel MCP** is the source of truth for production logs. Use broad queries (`since`, `limit`) — filters often miss errors.
- **GitHub** code is at `Ankur-dev01/thetafel-website` (main branch). The user mirrors the project knowledge with the latest committed state.
- **Project files** at `/mnt/project/` are read-only — view for reference, never edit.

### 15.4 Code reading before fixing

If a bug is reported, the first action is `view` on the suspected file (or several), reading the actual code. No proposing fixes blind. If the user provides logs, read them; if not, fetch from Vercel MCP.

A recurring bug across fixes means the root cause is elsewhere — open more code, do not propose another guess.

### 15.5 Push to main after every confirmed unit

After Claude Code reports success:

```powershell
git add .
git status
git commit -m "<conventional commit message>"
git push origin main
git log --oneline -3
```

The user pastes back the `git log` to confirm the push really happened. Claude Code occasionally reports phantom pushes — always verify.

### 15.6 Voice input

The user often dictates. Typos like "thes" for "this," "wht" for "what" are normal. Interpret charitably without commenting on them.

### 15.7 Brevity and token budget

- No multi-paragraph preambles. Get to the answer.
- No re-stating context the user already gave.
- No padding ("Great question!" / "Sure, happy to help" / "Let me think about this").
- When acknowledging a request, one line.
- When ending a response, no closing summary unless the user asked for one.

### 15.8 Plain English

Avoid jargon that the user might not recognise. Explain when you must use a term: "RLS means row-level security — each restaurant can only read its own data." "Idempotency key means a unique ID per submit, so retries don't create duplicates."

Buzzwords forbidden: synergy, leverage, robust, best-in-class, enterprise-grade, world-class, cutting-edge, paradigm. Just describe what the code does.

### 15.9 Security is a first-class concern, every prompt

Every prompt that touches a public endpoint, a form, or a payment must include in its prompt file:

- Rate limit treatment
- CAPTCHA placement
- Idempotency-key handling
- Audit-log emission

If any of these don't apply, the prompt says so explicitly ("no rate limit needed because this is a server-side cron"). No omission.

### 15.10 Stop signals

When the user says "stop," "wait," "don't do that," "let's pause" — stop immediately. Confirm what was already done. Wait for direction.

### 15.11 PRD precedence

This PRD is the source of truth for Phase 2 specification. If a request conflicts with the PRD, ask for clarification before building. If the conflict is intentional (PRD wrong, or scope is changing), update the PRD as the first commit in that chain. Never silently deviate.

---

## 16. Out of scope — Phase 3 boundary

Phase 2 ships the consumer side only. Phase 3 (restaurant dashboard) covers everything below. Implementing these prematurely is scope creep.

- Restaurant-facing live booking calendar
- Restaurant-facing order queue / kitchen view (a minimal version may ship as a thin-slice during Phase 2 for restaurants to receive orders — but full ops UI is Phase 3)
- Restaurant analytics dashboards
- Customer database (CRM) UI
- VIP guest tagging UI
- Custom email template editor
- Marketplace marketing tools (boost, featured listings)
- Manual booking creation/edit by staff
- Order modifications by staff
- Refund initiation by staff (Phase 2 ships an internal admin tool only)
- Staff accounts and permissions
- Multi-location support
- White-label / custom domains

A thin Phase 3 slice — "Today's bookings" + "Today's orders" read-only views — ships alongside Phase 2 so restaurants can see incoming activity. Full dashboard ships in Phase 3 proper.

---

## 17. Future updates designed for, not built

These decisions affect Phase 2 architecture so they don't require rework later.

### 17.1 Multi-language menus

Menu items have a `content_locale` and the schema allows multiple rows per item keyed by `(menu_item_id, locale)` via a `menu_item_translations` table. Phase 2 ships with one row per item; Phase 4 adds the translations join.

### 17.2 Multi-table bookings

`booking_tables` is a join table even though Phase 2 always inserts one row. Phase 4 group bookings, table merges, and splits use the same shape.

### 17.3 Multi-currency

Every monetary column has a `currency` partner. Defaults to `'EUR'`. Phase 4 expansion does not require migration.

### 17.4 Modifier-based menu items

`menu_items.modifiers` is JSONB. UI in Phase 2 ignores it. Phase 4 adds the picker. Schema is final.

### 17.5 Delivery

`service_delivery_enabled` flag exists. All consumer flows check it; when false (always in Phase 2), delivery UI is hidden. Phase 5+ adds the delivery sub-flow without schema change.

### 17.6 Marketplace listings

`restaurants.marketplace_visible`, `restaurants.marketplace_priority` exist. Set to default values in Phase 2; activated in Phase 4 marketplace launch.

### 17.7 Native mobile

A minimal `/api/v1/public/...` REST API surface is designed to be consumable by a future React Native app. No app-specific tokens in the spec — only standard session + magic-link auth.

### 17.8 Real-time updates

Supabase Realtime is available on day one. Phase 2 uses polling per §2.3 / §5 Q5. Switching to Realtime is a 1-day change if user demand warrants — schema unchanged.

### 17.9 Loyalty programmes

`guests.loyalty_points`, `guests.loyalty_tier` columns reserved. Default 0 / `'standard'`. Phase 5 activates.

### 17.10 Reviews

Post-booking review prompt and `reviews` table reserved in schema but not exposed in Phase 2 UI.

---

## 18. Glossary

- **The Tafel** — the platform, the brand, the product.
- **Phase 1** — restaurant onboarding wizard, shipped.
- **Phase 2** — consumer-facing surfaces (this document).
- **Phase 3** — restaurant operations dashboard.
- **Phase 4+** — marketplace, delivery, multi-region.
- **Slug** — the URL-friendly identifier for a restaurant (`de-zwarte-zwaan`).
- **Connected org account** — a Mollie merchant account owned by a restaurant, OAuth-linked to the platform.
- **Idempotency key** — a UUID generated client-side, sent in the request header, used to dedupe repeated submits.
- **Magic link** — a one-shot URL with an embedded token used for guest-facing actions (manage booking, view order).
- **Open tab** — for pay-at-table QR ordering, an `tabs` row representing the running bill on a table.
- **Booking ref** — short alphanumeric code (e.g. `T9F-4XQ2`) shown to the guest, used for support and check-in.
- **Pickup code** — short alphanumeric code (e.g. `PU-92X`) for takeaway pickup verification.
- **RLS** — Postgres Row-Level Security — per-row access policies.
- **ISR** — Next.js Incremental Static Regeneration — pages cached and revalidated on a schedule or on demand.
- **Mollie Connect** — Mollie's platform-for-marketplaces product, allowing one account (the platform) to act on behalf of many sub-merchant accounts (restaurants).
- **Turnstile** — Cloudflare's CAPTCHA replacement, free, privacy-preserving.
- **Resend** — transactional email API used by The Tafel.

---

End of document.
