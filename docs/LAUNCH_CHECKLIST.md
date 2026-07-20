# The Tafel — launch readiness checklist

Last audited: 2026-07-20
Last commit: d0b8433

## Gating conditions for public launch

Three things must all be true:

1. Onboarding part complete ✅ (shipped and live)
2. Consumer part complete ✅ (this chat closes it out — C9.1–C9.4)
3. Dashboard part complete ❌ (not yet started — see §14)
4. External blockers cleared ❌ (see §15)

**Consumer part being "done" does not mean the product is launchable.** Two
incidents were originally found during this audit — both turned out to be
resolved on closer investigation rather than open problems (see the Verified
section below for both: the Turnstile misconfiguration was a stale,
self-resolved finding, and the "live restaurant's Mollie connection broken"
finding turned out to be Ankur's own test accounts, not a real restaurant).

## Status summary

Approximate counts — the itemized sections below are the source of truth, not
this tally:

- ✅ Verified (including 2 fixed-in-this-unit items + 2 findings resolved on
  follow-up investigation): ~32
- 🟡 Needs attention: ~23
- 🔴 Blocking launch: 7

## Blocking items (🔴)

1. **Dashboard part not built** — Ankur owns; whole part delivered in a
   separate chat. See §14 for full scope.
2. **Mollie consumer webhook e2e verification** — cannot be tested until a
   *real* restaurant has a working Mollie connection. No restaurant currently
   does (see Verified section — the two that had any Mollie connection were
   both Ankur's own test accounts, now reset). Blocked on the dashboard part's
   OAuth connect/reconnect flow and an actual restaurant using it.
3. **Dutch lawyer sign-off** — T&Cs, DPA, privacy policy. Ankur owns, in
   flight, no code dependency.
4. **KVK production API key** — Ankur has applied; delivery pending from KVK.
5. **WhatsApp template approval** — submitted to Meta; 1–2 week review.
   `WHATSAPP_ENABLED` defaults to disabled either way (verified in code, §6).
6. **Resend suppression list** — `hallo@thetafel.nl` needs removing from
   Resend's suppression list or the team's own support inbox silently drops
   replies. Ankur owns (Resend dashboard action).
7. **Vercel env vars could not be enumerated** — the connected Vercel MCP tool
   set has no "list env vars" capability, and no Vercel CLI is available in
   this environment. Every "set/missing" mark in the env var table (below) is
   inferred from runtime-error evidence or is unverifiable — **Ankur should run
   `vercel env ls production` (or check the dashboard) directly** and confirm
   against that table before treating anything there as ground truth beyond
   what's explicitly marked "confirmed."

## Needs attention (🟡)

### Security & headers
- **CSP (Content-Security-Policy) not set.** Deliberately not added in this
  unit — building a correct policy requires enumerating every external
  script/connect source (Cloudflare Turnstile, Plausible, Supabase, Mollie
  checkout redirects) and risks breaking one of them if done carelessly. Owner:
  whoever picks up dashboard-part infra work; action: audit script-src /
  connect-src needs, then add via `next.config.ts` `headers()`.
- **No custom `not-found.tsx` / `error.tsx` / `global-error.tsx`** anywhere in
  `app/`. Next.js falls back to its own generic pages — functional but
  unbranded. Owner: whoever owns visual polish; this is a design decision
  (copy + layout), not a config fix, so left out of this unit's in-scope fixes.
- **`handle_new_user` / magic-link lookup RPCs had `PUBLIC`/`anon`/`authenticated`
  EXECUTE grants** — fixed in this unit (see §1 detail and commit `C9.4-2`).
  Flagging here only so the fix itself gets a paper trail.

### Payments
- **Mollie platform account (subscriptions) activation status** — not
  verifiable via any tool available here (Mollie dashboard only). Owner:
  Ankur; action: confirm platform account is fully activated (not just
  test-mode) in the Mollie dashboard.
- **iDEAL primary / card secondary** — confirmed in code
  (`createConnectedPayment` accepts `method: 'ideal' | 'creditcard'`, and the
  QR pay-mode UI defaults to no restriction, letting Mollie's own hosted
  checkout show iDEAL first for NL bank cards) but the *ordering* of payment
  methods on Mollie's hosted checkout page is a Mollie dashboard/profile
  setting, not app code. Owner: Ankur; action: confirm in Mollie dashboard
  checkout profile settings.

### Email
- **BCC-to-`hallo@thetafel.nl` on every consumer email** — confirmed
  deliberate in `lib/consumer/email/send.ts` (`skipAdminBcc` exists as an
  explicit opt-out per-send, and no call site currently uses it for guest
  emails). Per this unit's instructions, **not flipping this without
  discussion** — flagging for Ankur's decision: keep as intentional support
  visibility (document it), or gate behind an env flag / restrict to specific
  templates. No code changed here.
- **SPF / DKIM / DMARC records** — could not be verified (no DNS-query tool
  available, and this unit is explicitly barred from touching DNS). Owner:
  Ankur; action: add these three DNS records for `thetafel.nl` per Resend's
  own domain-setup docs, then re-verify in the Resend dashboard.
- **Bounce handling** — no bounce-tracking code exists (`sendConsumerEmail`
  logs Resend's immediate send result only, nothing consumes Resend's
  bounce/complaint webhooks). Documented gap, not fixed here — dashboard-part
  or a dedicated unit should wire a Resend webhook receiver if this matters at
  the current volume.

### Legal & compliance
- **Real KVK/BTW numbers on legal surfaces** — could not verify these are the
  *real* numbers (vs. placeholders) without knowing the real numbers; grepped
  and found `KVK: 42027611` / `BTW: NL005440779B20` in the marketing footer
  (`components/layout/Footer.tsx`) consistently. Owner: Ankur; action: confirm
  these match the actual KVK/BTW registration before public launch.
- **T&C / DPA / privacy policy legal review** — blocking item, see §Blocking.
- **Cancellation policy display** — confirmed present in the booking
  confirmation email template and the R7 confirmation page copy
  (`booking.r6.terms_disclaimer`, cancellation flow at
  `/r/{slug}/bookings/manage`); not confirmed on every restaurant-facing
  surface since restaurant-facing surfaces don't exist yet (dashboard part).

### Marketing website
- **"All 18 Website PRD steps closed"** — no `Website PRD` document exists in
  this repo (only Consumer PRD/BuildPlan/Schema and the Onboarding schema were
  found). Cannot verify against a document that isn't present. Owner: Ankur;
  action: locate or write that PRD if this checklist item is real, or drop it
  if the 18 steps are already tracked elsewhere.
- **Hardcoded statistics traced to real sources** — the homepage shows dynamic
  counts pulled from a `restaurants_analyzed` style research stat (per the
  earlier Playwright MCP smoke-test snapshot: "0 restaurants geanalyseerd", "0%
  heeft geen eigen boekingssysteem" — these render as literal `0`s right now,
  not removed placeholder copy). Owner: whoever owns the research data;
  action: either wire real numbers or remove the stat blocks before launch.

### Infrastructure
- **Apex→www redirect is a 307 (temporary), not 301/308 (permanent)** —
  confirmed live via `curl -I https://thetafel.nl/`. This is a Vercel
  domain-config default, not app code. Minor SEO nit, not a functional
  blocker. Owner: Ankur; action: check Vercel's domain redirect settings for a
  permanent-redirect option, if available on the current plan.
- **Dead/unused env vars in `.env.local`**: `NEXT_PUBLIC_PLAUSIBLE_DOMAIN`,
  `MESSAGEBIRD_API_KEY`, `CRON_SECRET` are all present locally but never read
  anywhere in the codebase (grepped `process.env.` repo-wide — zero hits for
  any of the three). Plausible's domain is hardcoded directly in
  `PlausibleLoader.tsx` instead. Not harmful, just noise — clean up whenever
  convenient, not urgent.
- **No cron jobs configured** (`CRON_SECRET` is unused, no `vercel.json`
  present) — fine if nothing needs scheduling yet; flagging only because the
  env var's existence implied one was planned.

### Monitoring
- **Error monitoring** — no Sentry or equivalent wired; Vercel's own
  `get_runtime_errors`/`get_runtime_logs` (used throughout this audit) is the
  only current visibility, and it requires someone to actively query it — there's
  no push/alert path. Owner: Ankur; action: decide whether Vercel's built-in
  logging is sufficient or whether Sentry (or similar) should be added — this
  is a scope/cost decision, not something to silently add here.
- **Uptime monitoring for `thetafel.nl`** — no external tool wired (nothing in
  this repo could tell either way; this is inherently an external service).
  Owner: Ankur; action: set up UptimeRobot/Better Stack/etc. if wanted before
  launch.
- **Alert routing** — no alerting exists to route anywhere yet, since no
  monitoring tool is chosen. Same owner/action as above.

### Operational readiness
- **Support inbox monitoring, incident response, Vercel-outage backup plan,
  runbook, first-restaurant onboarding plan** — all organizational/process
  items with no code surface to verify. Owner: Ankur for all five; these are
  plans to write, not things this audit can check or fix.

## Verified (✅)

### Security (§1)
- ✅ RLS enabled on all 29 `public.*` tables (queried `pg_class.relrowsecurity`
  directly — zero tables with RLS off).
- ✅ `SECURITY DEFINER` function grants locked down — `anonymise_guest` was
  already service_role-only; `handle_new_user`, `lookup_booking_by_magic_link`,
  `lookup_order_by_magic_link` had `PUBLIC`/`anon`/`authenticated` EXECUTE
  grants and have been revoked to service_role-only in this unit (migration
  `revoke_public_execute_on_security_definer_functions`). Confirmed no
  application code called these via anon/authenticated clients — all app call
  sites use the service-role admin client already, so this is a pure
  hardening fix with zero functional change.
- ✅ `SUPABASE_PROD_SERVICE_ROLE_KEY` only referenced server-side — every
  grep hit is in a `server-only`-guarded file or a Node script
  (`scripts/seed-menu-photos.ts`, `lib/supabase/server.ts`,
  `tests/e2e/fixtures/test-restaurant.ts`, `playwright.config.ts`). No hit in
  any client component or file shipped to the browser.
- ✅ Mollie API calls are all server-side — grepped `mollie` (case-insensitive)
  across `components/`; the only three hits are client-side string matches on
  error codes (`code.startsWith('mollie_')`), not API calls. All real
  `@mollie/api-client` usage lives under `lib/mollie/*`, all `server-only`.
- ✅ Consumer write endpoints follow the doorman convention — spot-checked
  `bookings/create`, `v1/public/[slug]/order`, `v1/public/[slug]/takeaway-order`:
  each does rate limit → Zod → Turnstile → doorman
  (`assertConsumerWriteAllowed`/`loadBookingConfig`) → idempotency-checked
  insert → audit log, in that order.
- ✅ No PII in `console.log`/`console.error` calls — grepped for email/phone/
  name near log calls; every hit was a log *label* string ("email failed"),
  never the actual PII value. IP addresses are consistently passed through
  `redactIp()` before logging (`lib/consumer/rateLimit.ts`).
- ✅ Consumer webhook (`/api/webhooks/mollie/consumer`) correctly has no
  signature check — this is intentional and correct for Mollie's older
  unsigned-webhook payment style (`client.payments.create({ webhookUrl })`);
  the code re-fetches the payment's real status from Mollie's API using the
  restaurant's OAuth token rather than trusting the webhook body, which is the
  right pattern for this webhook shape. The *other* webhook
  (`/api/mollie/webhook`, platform subscription billing) does verify a real
  HMAC signature with a `NODE_ENV`-gated dev bypass.
- ✅ `pgcrypto`/`digest()` search-path — `anonymise_guest` is the only
  SECURITY DEFINER function using `digest()`-style hashing patterns in this
  codebase's actual usage (token hashing happens in application code via
  Node's `crypto`, not in SQL) — no live search-path exposure found.
- 🔧 **Fixed in this unit**: security headers added to `next.config.ts`
  (`Strict-Transport-Security`, `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`).
  Vercel already injects its own HSTS header at the platform level (confirmed
  via `curl -I` against prod) — this makes it explicit and adds the other
  three, which were completely absent.
- 🔧 **Fixed in this unit**: `robots.ts` now disallows `/api/` and any
  `_`-prefixed restaurant slug (`/r/_*`, `/en/r/_*`) — previously allowed
  everything with no disallow rules at all.
- ✅ **Resolved (was a stale finding)**: `TURNSTILE_SECRET_KEY missing in
  non-dev env` — a follow-up diagnosis (re-reading `lib/consumer/turnstile.ts`
  and cross-referencing the Mollie incident's timeline) showed this error only
  occurred in an ~18-hour window, 2026-07-12 15:34 UTC → 2026-07-13 09:42 UTC,
  and never recurred. Direct proof it was already fixed by 2026-07-15: real
  takeaway checkout attempts against a live restaurant that day got past
  Turnstile verification and failed later, at the Mollie payment step — which
  only happens if Turnstile had already passed. This was almost certainly a
  Vercel environment-variable propagation gap (var added to Production but the
  already-running serverless functions hadn't redeployed yet), not a Cloudflare
  rejection — the code never even reached the `siteverify` call; it short-
  circuited on a missing-secret guard before that. No action needed.
- ✅ **Resolved (was Ankur's own test data, not a real restaurant)**: "live
  restaurant's Mollie connection broken." A dedicated investigation (Supabase
  MCP, read-only) found exactly two restaurants with any Mollie connection at
  all: `288b0437-81da-4089-98e4-d89227a98004` (owner `karanguptaa36@gmail.com`,
  `status='live'`, `mollie_status='verified'` with a broken OAuth refresh
  token) and `203feed6-2e2c-4118-adfa-ad67b1733292` (owner
  `ankuranmol012@gmail.com`, `status='onboarding'`, display name literally
  "Ankur's Restaurant"). Both confirmed as Ankur's own test accounts — no
  external restaurant or real customer was ever affected. Both reset to
  `mollie_status='not_started'` (Mollie fields cleared) via Supabase MCP on
  2026-07-20; 2 rows affected. No restaurant currently has a live Mollie
  connection, broken or otherwise.

### Infrastructure (§3)
- ✅ Vercel prod points at `thetafel.nl` / `www.thetafel.nl` +
  `thetafel-website.vercel.app`, latest deployment `READY` on `production`
  target (confirmed via `get_project`).
- ✅ Domain verified + SSL active — `curl -I https://thetafel.nl` and
  `https://www.thetafel.nl` both return valid HTTPS responses with HSTS.
- ✅ `www.thetafel.nl` is canonical; apex redirects to it (307 — see 🟡 nit
  above).
- ✅ Root `/` locale-routes correctly — confirmed live: sets
  `NEXT_LOCALE=nl` cookie, serves Dutch content, `hreflang` alternates present
  for `nl`/`en`/`x-default`.
- ✅ `sitemap.xml` live and marketing-only — confirmed via `curl`: 7 URLs, all
  marketing pages (home, `/en`, privacy, T&Cs ×2, DPA ×2). No restaurant slugs,
  no test restaurant.
- 🔧 **Fixed in this unit**: `robots.txt` (see above).
- ✅ Dev-only API routes (`/api/dev/*`) hard-404 in production — confirmed
  live: `curl -I -L https://thetafel.nl/api/dev/security-check` →
  `404 Not Found`, `X-Matched-Path: /api/dev/security-check` (route exists in
  the bundle, but its own `NODE_ENV==='production'` guard fires correctly).
- ✅ `_e2e_test_restaurant` not crawlable / not in sitemap — confirmed the
  sitemap has zero restaurant entries at all, and the new `robots.txt` rule
  explicitly disallows `_`-prefixed slugs as defense in depth.

### Analytics & consent (§7)
- ✅ Plausible script absent without consent — verified in code
  (`PlausibleLoader.tsx`): `getServerConsentSnapshot()` always returns `false`,
  and the component returns `null` before rendering the `<Script>` tag unless
  `analyticsAllowed` is true. Also directly observed in the C9.3a smoke-test
  snapshot: no Plausible script present, cookie banner shown on first load.
- ✅ Cookie banner renders on first visit, three categories (essential/
  analytics/marketing), dismissible — verified in `components/consent/
  CookieBanner.tsx` and exercised directly by the e2e smoke test.
- ✅ Consent persists 365 days — `lib/consent.ts` `MAX_AGE_MS = 365 * 24 * 60
  * 60 * 1000`, checked on every read.
- ✅ No PII sent to Plausible — the script tag only carries `data-domain`; no
  custom event code sends guest data anywhere in the codebase (grepped for
  `plausible(` calls — none found beyond the loader itself).

### Consumer surfaces (§10)
- ✅ Playwright suite green — 6/6 passing as of C9.3c (smoke, booking ×2, QR,
  takeaway, GDPR), re-confirmed in this unit's verification pass (§ below).
- ✅ Wordmark bug (C8.3, commit `10eb0ed`) — already shipped; visually
  re-confirmed via every Playwright MCP snapshot taken across C9.3a–c (wordmark
  renders as "THE" / "TAFEL" stacked correctly, no overlap/clipping observed).
- 🟡 Booking/QR/takeaway flows on a **real physical phone** — not automatable
  from this environment (no physical device, no camera). Owner: Ankur;
  action: manually run one booking flow and one QR-scan flow on a real phone
  before launch.
- 🟡 Takeaway full happy path — blocked at Mollie for the same reason as
  §Blocking #3/#4 (no restaurant has a live, working Mollie connection right
  now).

### WhatsApp (§6)
- ✅ `WHATSAPP_ENABLED` fails safe — `lib/consumer/whatsapp/send.ts` reads
  `process.env.WHATSAPP_ENABLED === 'true'`; any missing/falsy value (the
  default, since it's absent from `.env.local` entirely) means WhatsApp is
  disabled and the dispatcher falls back to email only. No explicit `false`
  needs to be set for this to be safe — confirmed by code reading, not by
  inspecting the live Vercel value (which this unit couldn't enumerate).

### Marketing website (§9)
- ✅ Dutch default at `/`, English at `/en/` — confirmed live (see
  Infrastructure §3 above).
- ✅ Locale toggle present — confirmed on every marketing/consumer page
  visited during C9.3a–c (`Nav.tsx`'s NL/EN button, `ConsumerLanguageToggle`
  on consumer pages).
- ✅ No dark mode — grepped for `prefers-color-scheme` and `dark:` Tailwind
  variants across `app/` and `components/` — no hits.

### Onboarding surfaces (§11 — shipped, spot-checked only)
- ✅ Restaurant can enable/disable each service independently — confirmed via
  schema: `service_reservations_enabled` / `service_qr_enabled` /
  `service_takeaway_enabled` are independent booleans, and the doorman
  (`assertConsumerWriteAllowed`) checks the specific flag for the specific
  action, not a combined "any service" flag.
- 🟡 Real KVK API key, subscription checkout e2e, IBAN verification — these
  are onboarding-part items already shipped and outside this audit's ability
  to re-verify without onboarding-specific test coverage (none exists in this
  repo's Playwright suite, which is consumer-part only). Owner: whoever owns
  onboarding follow-up; not re-verified here.

## Deferred to dashboard part (see `docs/PART_3_DASHBOARD_DEFERRED.md`)

Pass-through of that file so this doc is the one place to look:

1. **Full deposit → booking linkage** — `bookings.deposit_intent_id` exists as
   a schema column but is unused in application code; the booking flow has no
   deposit field, the consumer Mollie webhook treats `purpose==='deposit'` as
   a no-op, and no refund-resolution helper exists.
2. **`assertConsumerWriteAllowed` / `loadBookingConfig` don't check billing
   health** — a restaurant with a failed subscription payment can still accept
   consumer bookings/orders today. `subscriptions.status` isn't read by either
   gate.
3. **Duplicate `qr_item_notes_allowed` / `qr_item_notes_enabled` columns** on
   `restaurants` — the old Phase 1 column is still read/written by onboarding;
   drop deferred until onboarding migrates to the new one.
4. **Missing `metadata`/test-isolation columns** on `guests`/`bookings`/
   `orders` — worked around in the e2e fixtures via a distinctive guest email
   pattern instead; a real column would be cleaner if test suites grow.

Plus everything enumerated in this unit's §14 below (dashboard part scope,
not carried over from the old deferred-items file since it wasn't written yet
when that file was created).

## §14 — Dashboard part (not started — biggest remaining launch blocker)

🔴 **Blocking public launch as a whole.** None of this exists yet; it ships in
a separate chat. Enumerated here so the checklist reflects reality:

- Restaurant "Today" view (bookings + orders + tabs).
- Individual staff logins with roles (owner, manager, waiter, kitchen).
- Menu editor.
- Opening-hours + prep-time editor.
- Guest database + export UI.
- **Tab settlement UI** — QR pay-at-table tabs currently accumulate with no
  way to close them (confirmed in C9.3c: `tabs.status='open'` after every
  pay-at-table order, nothing in the current codebase ever transitions a tab
  to `'settled'`).
- Refund handling for QR and takeaway orders.
- Ready-for-pickup notification trigger.
- Restaurant-side view of GDPR requests.
- Custom email templates (Premium tier).
- VIP guest tagging.
- Priority placement + Premium QR design + brand-pack uploader.
- Full deposit → booking linkage (dashboard-deferred item #1 above).
- Billing/subscription-status blocking of consumer writes (dashboard-deferred
  item #2 above).
- Real Mollie sandbox happy-path e2e test (blocked until a restaurant OAuth
  flow exists to connect against).
- Onboarding column cleanup — drop `qr_item_notes_allowed` (dashboard-deferred
  item #3 above).
- **New, surfaced by this audit**: a visible "reconnect payments" UI state for
  when a restaurant's Mollie OAuth token goes invalid — the incident that
  surfaced this (see Verified, §1) turned out to be Ankur's own test account,
  but the underlying gap is real: nothing in the current codebase tells a
  restaurant owner their Mollie connection has gone bad. Right now that
  failure is completely silent to the restaurant owner.

## §15 — External blockers (owned outside code)

None of these can close in this unit:

- **Mollie e2e verification** — blocked till a real restaurant connects
  Mollie and uses it (dashboard-part prerequisite: the connect/OAuth flow
  doesn't exist yet, and no restaurant currently has a live connection to
  test against — see Verified, §1).
- **WhatsApp template approval** — Meta review, 1–2 weeks after submission.
- **KVK production API key** — Ankur applied, delivery pending.
- **Dutch lawyer sign-off** — T&C, DPA, privacy policy.
- **Resend suppression list removal** — `hallo@thetafel.nl`.
- **SPF/DKIM/DMARC DNS records** — Ankur owns DNS; this unit documented what's
  needed but didn't touch DNS (out of scope per this unit's own instructions).

## Env var checklist (Vercel prod, `prj_EczZPmBkHS4009z3tyYrhnsylTfy`)

**Could not enumerate directly** — no tool in the connected Vercel MCP set
lists environment variables (only `get_project`, deployment/log/error tools,
and purchase-related tools are available), and no Vercel CLI or `.vercel/`
project link exists in this environment. Values below are inferred from
runtime-error evidence where possible; everything else is marked
`unverified — run \`vercel env ls production\` to confirm`.

| Variable | Status | Evidence |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_PROD_URL` | likely set | No Supabase connection errors against the prod project in 7d runtime logs |
| `NEXT_PUBLIC_SUPABASE_PROD_ANON_KEY` | unverified | — |
| `SUPABASE_PROD_SERVICE_ROLE_KEY` | likely set | Admin-client-dependent routes (booking, orders) are succeeding in prod per runtime logs |
| `RESEND_API_KEY` | likely set | No `[sendConsumerEmail] missing config` errors in 7d logs |
| `MOLLIE_CLIENT_ID` | likely set | The connected restaurant reached a real Mollie OAuth flow at some point (has `mollie_organization_id`) |
| `MOLLIE_CLIENT_SECRET` | likely set | Same as above |
| `MOLLIE_WEBHOOK_SIGNING_SECRET` | unverified | No subscription-webhook traffic seen in the 7d log window either way |
| `MOLLIE_API_KEY` (platform key, used by `lib/mollie/client.ts`) | unverified | — |
| `TURNSTILE_SECRET_KEY` | resolved — set | Confirmed present since ≥2026-07-15: real requests reached the Mollie payment step that day, which only happens after Turnstile verification passes. The 2026-07-12/13 "missing" error was a transient env-propagation gap, already closed. |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | likely set | Ankur confirmed the client-side widget renders and passes in prod |
| `UPSTASH_REDIS_REST_URL` | likely set | No rate-limiter errors in 7d logs; consumer routes are enforcing rate limits without erroring |
| `UPSTASH_REDIS_REST_TOKEN` | likely set | Same as above |
| `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_TOKEN` | unverified | Code reads `WHATSAPP_TOKEN`, not `WHATSAPP_ACCESS_TOKEN` — naming mismatch vs. the brief's checklist, see note below |
| `WHATSAPP_PHONE_NUMBER_ID` / `WHATSAPP_PHONE_ID` | unverified | Code reads `WHATSAPP_PHONE_ID` — same naming note |
| `WHATSAPP_ENABLED` | safe by default | Code treats anything other than the literal string `'true'` as disabled — verified in `lib/consumer/whatsapp/send.ts` |
| `KVK_API_KEY` | likely set | Onboarding KVK search/profile routes are part of the already-shipped, live onboarding part |
| `KVK_API_BASE_URL` | likely set | Same as above |
| `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` | **unused in code** | `PlausibleLoader.tsx` hardcodes `data-domain="thetafel.nl"` directly instead of reading this var |
| `NEXT_PUBLIC_SITE_URL` | unverified | Read in several routes for building absolute URLs (magic links, redirect URLs); falls back to `'https://thetafel.nl'` if unset |
| `QR_BASE_URL` | unverified | Read for QR image generation and payment redirect/description URLs |
| `MOLLIE_REDIRECT_URI` | unverified | Read by the Mollie OAuth client setup |
| `MOLLIE_DEV_BYPASS_WEBHOOK_SIGNATURE` | should be unset/false in prod | Dev-only bypass flag for the subscription webhook's signature check |
| `NEXT_PUBLIC_DASHBOARD_URL` | unverified | Read once, in the onboarding "live" page — dashboard part doesn't exist yet, so this presumably points nowhere real yet |
| **Dead vars found in `.env.local`, never read anywhere in code**: `MESSAGEBIRD_API_KEY`, `CRON_SECRET` | n/a | Grepped `process.env.` repo-wide — zero hits for either |

**Naming mismatch worth flagging**: this checklist's own brief listed
`WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID`, but the actual code
(`lib/consumer/whatsapp/send.ts`) reads `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_ID`.
If Vercel prod has the brief's names set instead of the code's names, WhatsApp
would silently stay in its `misconfigured` fallback state even with
`WHATSAPP_ENABLED=true`. Worth a direct check whenever WhatsApp is actually
turned on.

## How to re-run this audit

```bash
# RLS status for every public table
# (via Supabase MCP execute_sql, or psql directly)
SELECT c.relname, c.relrowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' ORDER BY c.relname;

# SECURITY DEFINER function grants
SELECT p.proname, (SELECT array_agg(acl::text) FROM unnest(p.proacl) acl) AS acl
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prosecdef=true ORDER BY p.proname;

# Recent production runtime errors (requires Vercel MCP or dashboard access)
# get_runtime_errors(projectId: prj_EczZPmBkHS4009z3tyYrhnsylTfy, since: "7d")

# Env vars actually configured on Vercel prod (this audit could not run this)
vercel env ls production

# Live infra checks
curl -sI https://thetafel.nl/               # HSTS, redirect behavior
curl -sI -L https://thetafel.nl/api/dev/security-check  # must 404
curl -s -L https://thetafel.nl/sitemap.xml  # marketing pages only
curl -s -L https://thetafel.nl/robots.txt   # disallow /api/, /r/_*

# Full e2e suite
npm run test:e2e

# Build
npm run build
```
