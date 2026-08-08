# The Tafel — Dashboard Build Plan v1.0

**Document:** TheTafel_Dashboard_BuildPlan_v1.0.md
**Companion to:** TheTafel_Dashboard_PRD_v1.0.md (the spec), TheTafel_Dashboard_Schema_v1.0.sql (the DDL)
**Working method:** identical to Parts 1 and 2 — one unit at a time, prompt files for Claude Code CLI, confirmation before advancing, `git push origin main` after every unit, Playwright verification via the Part-2 test infrastructure.

---

# 0. Shape of the plan

Ten phases, D0 through D9, ordered so that every phase leaves the product in a shippable state and each phase's output is verifiable on its own. The dependency spine:

```
D0 foundation → D1 Today → D2 Bookings → D3 Orders+Tabs → D4 Menu
             → D5 Settings (3 waves) → D6 Money → D7 Guests+Insights
             → D8 Staff roles → D9 Hardening + launch
```

Money (D6) deliberately comes after the operational pages (D1–D5): refunds and deposits need the booking/order surfaces to exist first, and D6 is the phase that finally requires a real Mollie OAuth connection — giving maximum time for that external dependency to resolve.

Staff roles (D8) come late on purpose: everything D1–D7 is built and verified as the owner account, then D8 layers role-gating over finished surfaces. Building role-gates against unfinished pages would mean re-testing every gate every time a page changes.

Estimated weight per phase (in "units" — one unit ≈ one prompt file ≈ one confirmed sitting): D0×4, D1×3, D2×4, D3×5, D4×3, D5×8, D6×5, D7×4, D8×4, D9×5. ≈ 45 units total.

---

# D0 — Foundation (4 units)

The shell everything else mounts into.

**D0.1 — Schema wave 1.** Apply the dashboard schema (Schema doc §1–§3): `restaurant_staff`, `staff_invites`, `dashboard_audit_logs`, `availability_exceptions`, new columns on `restaurants` (`paused_at`, `grace_period_started_at`), new columns on `bookings` (`source`), new enum values, RLS policies for staff-membership reads. Verify via MCP against live DB; trust live over files per standing rule.

**D0.2 — Dashboard shell.** `app/[locale]/dashboard/layout.tsx`: auth guard (redirect to `/login` preserving destination), staff-membership resolution, the responsive chrome — desktop sidebar (reusing onboarding's sidebar patterns), phone bottom tab bar, header with restaurant name + live-status chip + language toggle. Owner-only in this phase (staff logins arrive in D8; the membership check passes for the owner via `restaurants.user_id`).

**D0.3 — Shared dashboard components.** `components/dashboard/`: StatTile, AlertStrip, StatusChip (the four tones), EntityCard (booking/order card base), DetailSheet (phone) / DetailPanel (desktop), ConfirmDialog, EmptyState (with illustration slot), DateNav, section-header primitives. The ~25 hand-drawn icons (PRD §12). Every button `tafel-tap`.

**D0.4 — Data + polling layer.** `lib/dashboard/`: server-side query helpers per section (today, bookings, orders, tabs), the polling hook (60s/10s cadences, backoff, "Verbinding verbroken" strip on repeated failure), `dashboardAudit()` helper, permission map stub (`lib/dashboard/permissions.ts` — owner-passes-all until D8). Redirect `/onboarding/live` → `/dashboard`.

**Gate:** shell renders on phone + desktop, empty pages route, build clean, smoke Playwright test (dashboard loads for owner, redirects for anonymous).

---

# D1 — Vandaag / Today (3 units)

**D1.1 — Stat tiles + timeline.** The four tiles with real queries; the merged bookings+pickups timeline with "Eerder vandaag" collapse; polling live.
**D1.2 — Alert strip.** The alert queries (Mollie broken, stale-ready orders, overdue tabs, failed payments, pending deposits, delivery failures), priority ordering, per-day per-device dismissal, links through to sections.
**D1.3 — Pause control + states.** Pause/resume flow (PRD §5): `paused_at` write, consumer-surface gating (doorman reads it), banners, empty-day and error states.

**Gate:** Today is fully live against real data; Playwright test covering tiles + timeline + pause round-trip.

---

# D2 — Reserveringen / Bookings (4 units)

**D2.1 — List + date nav + filters.** Day navigation, service-block grouping, summary line, status filter chips, guest-name search (trigram, server-side).
**D2.2 — Detail panel/sheet.** Full booking detail incl. status history from audit log; tap-to-call on phone.
**D2.3 — Status actions.** Aangekomen / No-show / Annuleren with confirm dialogs, reasons, monotonic transitions, audit, guest cancellation email. (No-show deposit consequences arrive in D6 — until then the dialog notes deposit handling as pending when a deposit exists.)
**D2.4 — Edit + walk-in.** Change table/time/size with full server-side availability re-validation (slot lock, half-full rule); update email to guest. Walk-in quick-add (`source='walk_in'`, no email); Starter's 30-booking limit check explicitly excludes walk-ins (PRD §13.5). Swipe accelerators on phone.

**Gate:** every booking action Playwright-tested against the e2e test restaurant, including a walk-in and a table-change conflict rejection.

---

# D3 — Bestellingen + Tabs (5 units)

**D3.1 — Order queue.** Board (desktop) / list (phone), QR/takeaway filter, 10s polling, live "x min geleden," item-notes amber flagging, stale-ready pinning.
**D3.2 — Status actions.** Accepteren / In de keuken / Klaar / Geserveerd / Opgehaald per the transition graph; takeaway `ready` fires the ready-notification email + `ready_notified_at` (draining that deferred item); cancel with reason (refund offer stubs to D6).
**D3.3 — Kitchen mode.** Kitchen-focused full-screen layout, thumb-edge advance buttons, the chime (off by default, per-device persisted, single unobtrusive tone).
**D3.4 — Tabs list + detail.** Open tabs, oldest-first, totals + VAT summary, closed archive.
**D3.5 — Close-tab flow.** Settlement sheet (Betaald aan tafel / afboeken with reason), orders → `completed`, tab closed + stamped, audit; overdue-tab alert wiring.

**Gate:** full QR pay-at-table lifecycle — order placed on consumer surface → appears in queue → advanced to served → tab closed — as one Playwright test.

---

# D4 — Menu (3 units)

**D4.1 — Category + item lists.** Ordering (drag handles), photo thumbnails, price display, the 86 availability toggle with instant cache invalidation.
**D4.2 — Item editor.** Full NL/EN fields, price, photo upload (Storage), allergen chips, category move; server validation; consumer-cache invalidation on every save.
**D4.3 — Category editor + windows.** NL/EN names, reorder, optional availability windows enforced on consumer surfaces; zero-item empty-state onboarding.

**Gate:** edit an item's price in dashboard → see it changed on the consumer QR menu within seconds (Playwright, both surfaces in one test).

---

# D5 — Settings (8 units, three waves)

**Wave 1 — operational editors (reuse onboarding editors):**
**D5.1 — Hours + exceptions.** Availability editor reuse + `availability_exceptions` CRUD + consumer availability-check extension + future-booking conflict warning.
**D5.2 — Floor plan.** Zones/tables editor reuse + the dashboard-only guards (future-booking, open-tab, QR-death blocks; half-full re-validation flags).
**D5.3 — Booking rules + ordering.** Steps 4–7 settings as living editors incl. prep-time; changes affect new bookings/orders only.

**Wave 2 — service configuration:**
**D5.4 — QR settings.** Toggles + accent + menu language; QR management (preview, download, regenerate with double-confirm, ZIP); the `qr_item_notes_allowed` → `qr_item_notes_enabled` migration: point onboarding code at the Part-2 column, then drop the Part-1 column (draining that deferred item).
**D5.5 — Notifications settings.** Event × channel matrix, extra recipients; restaurant-facing email templates on the existing dispatcher.
**D5.6 — Branding.** Plus widget colours; Premium brand-pack uploader with fulfilment expectations copy.

**Wave 3 — account plane:**
**D5.7 — Payments (Mollie surface).** Status card with live token-validity check, state-meaning copy, Opnieuw verbinden into the reused OAuth flow, broken-connection alert + daily-capped owner email. *(This unit is where Ankur reconnects a real Mollie org to the test restaurant — unblocking D6.)*
**D5.8 — Account + settings hub polish.** Hub cards with state summaries; account self-service (name, email re-verify, password, language).

**Gate:** every onboarding-configured setting editable post-launch; hub complete; Playwright per editor.

---

# D6 — Money (5 units) — requires real Mollie OAuth from D5.7

**D6.1 — Refunds.** Terugbetalen on paid QR/takeaway orders: Mollie refund server-side, `refunded` transitions, guest email, honest failure + retry, audit. Full refund only.
**D6.2 — Deposit flow, consumer side.** The narrowed-C9.1 completion: frontend wires start-deposit → payment wait → `deposit_intent_id` into booking create; webhook `purpose='deposit'` branch; both metadata directions (the original C9.1 Step 3 backfill lands here, inside the booking transaction).
**D6.3 — Deposit flow, dashboard side.** `resolveDepositForBooking`; No-show keeps deposit (recorded + guest notified per policy); cancels refund via D6.1 machinery.
**D6.4 — Billing page.** Tier + trial countdown + mandate management + invoice PDFs + up/downgrade flows + cancellation survey.
**D6.5 — Grace period enforcement.** Failed-subscription webhook → `grace_period_started_at`, day-1/7/12 emails + banner, day-14 auto-pause (`billing_suspended`), doorman subscription-health check (draining deferred item 2), instant un-pause on payment. The real-Mollie happy-path e2e test lands here (draining that deferred item).

**Gate:** a real test-mode iDEAL payment refunded end-to-end; a deposit taken, kept on no-show, and refunded on cancel; grace-period state machine unit-tested + one e2e.

---

# D7 — Guests + Insights (4 units)

**D7.1 — Guest list + search + detail.** Restaurant-scoped history, spend, notes (with the GDPR-visibility hint), anonymised-guest handling.
**D7.2 — Export + VIP + Starter teaser.** CSV export (audited, consent-flagged, anonymised excluded); Premium VIP toggle on `loyalty_tier`; Starter blurred teaser + upgrade CTA.
**D7.3 — Insights core (Plus).** Bezetting, patterns, orders, top/bottom dishes — brand-styled recharts, real queries, honest-comparison rules.
**D7.4 — Insights revenue (Premium) + privacy page.** Revenue set; `/settings/privacy` GDPR request log + explainer.

**Gate:** tier-gating verified for all three tiers (test restaurant tier-flipped via MCP per test); export CSV content asserted in Playwright.

---

# D8 — Staff roles (4 units)

**D8.1 — Invite lifecycle.** Team page, invite email (magic-link infra, new purposes), acceptance + password set, deactivation, role changes.
**D8.2 — Enforcement.** Permission map completed for all four roles; every dashboard API route checks it; RLS switched from owner-only to staff-membership basis (Schema §3 wave 2); per-action audit attribution.
**D8.3 — Role-shaped UI.** Nav + actions per role; kitchen single-purpose layout binding; per-staff language preference.
**D8.4 — Role test matrix.** Playwright: one spec per role asserting both what they can see/do and what they cannot (403s asserted, not just hidden buttons).

**Gate:** the role matrix suite green; a service-role user cannot reach billing by URL; kitchen user sees only the queue.

---

# D9 — Hardening + launch (5 units)

**D9.1 — Security pass.** Every dashboard write: permission check + audit + monotonic guard + rate limit where guest-triggerable; SECURITY DEFINER grant audit on anything new; PII-logging grep.
**D9.2 — Performance pass.** Today <1.5s on 4G; polling backoff verified; degraded-mode strip verified.
**D9.3 — Full e2e regression.** Part-2 suite + all dashboard suites in one run; flake-hunt; suite runtime budget ≤ 8 minutes.
**D9.4 — Deferred-file drain audit.** Walk `PART_3_DASHBOARD_DEFERRED.md` item by item: shipped (link the unit) or explicitly re-deferred with reason. File ends empty or with a new named successor file.
**D9.5 — Launch checklist v2.** Re-run the C9.4 audit including all dashboard surfaces; update `docs/LAUNCH_CHECKLIST.md`; the launch gate now reads: all three parts complete, external blockers listed with owners.

**Gate:** launch checklist shows the dashboard part green. Public launch becomes a business decision, not a technical one.

---

# External dependencies watched during this part

- **Mollie OAuth** — needed by D6; created by Ankur via D5.7 on the test restaurant. If unavailable when D6 starts, D7 can run first (D6 and D7 are independent).
- **WhatsApp templates** — restaurant-facing notifications ship email-first; WhatsApp channels light up whenever Meta approves, no code dependency.
- **Lawyer sign-off, KVK key, Resend suppression** — unchanged from the Part-2 checklist; not dashboard-blocking.

---

*End of TheTafel_Dashboard_BuildPlan_v1.0*
