# The Tafel — Restaurant Dashboard PRD v1.0

**Document:** TheTafel_Dashboard_PRD_v1.0.md
**Part:** 3 of 3 (Onboarding → Consumer → **Dashboard**)
**Status:** Draft for review
**Depends on:** TheTafel_Onboarding_PRD_v1.0, TheTafel_Consumer_PRD_v1.0, TheTafel_BrandGuidelines_v1.0, TheTafel_UI_Spec_v1.0

---

# 0. What this document is

The complete specification for the restaurant-facing dashboard at `thetafel.nl/dashboard` — the web app a restaurant owner and their staff open every day to run their restaurant on The Tafel. It replaces the interim `/onboarding/live` landing page.

This is the third and final part of the core product. Onboarding gets a restaurant set up. The consumer surfaces let guests book, order, and pay. The dashboard is where the restaurant sees all of it, acts on all of it, and changes any of it.

The dashboard is a **web app, mobile-first in behaviour**. Restaurant owners live on their phones — during service they will check today's bookings from a phone behind the bar, mark orders ready from a phone in the kitchen doorway, and close tabs from a phone at the counter. Every page in this PRD is specified with its phone behaviour first-class, not as an afterthought. The desktop layout is the expanded version of the phone layout, not the other way round.

## 0.1 The problem this dashboard solves

Restaurant owners using booking platforms today face the same recurring frustrations, and every page in this document is designed against them:

1. **"Where is tonight?"** — The single most-opened view in any restaurant tool is *what's happening today*. Most platforms bury it under analytics and settings. The Tafel's dashboard opens on Today, always.
2. **"I found out too late."** — A no-show, a big party arriving in 20 minutes, an order sitting ready for ten minutes, a failed payment. The dashboard's job is to surface the thing that needs attention *right now*, above everything that doesn't.
3. **"I can't change anything without calling support."** — Opening hours, menu prices, table layout, no-show rules: every setting a restaurant configured during onboarding must be editable in the dashboard, by the owner, without help.
4. **"My data is hostage."** — Guest lists, booking history, revenue numbers. Commission-based platforms treat restaurant data as their asset. The Tafel treats it as the restaurant's: visible, filterable, exportable.
5. **"Too many screens during service."** — During a Friday-night rush, nobody has time for navigation trees. The three service-time actions (see bookings, act on orders, close tabs) are each at most two taps from opening the app.

## 0.2 What the dashboard is NOT

- Not a POS system. It does not replace the till. Tabs opened via QR pay-at-table are settled here, but general restaurant billing is out of scope.
- Not a kitchen display system (KDS) in v1. The order queue is usable from a kitchen phone/tablet, but dedicated KDS hardware integration is a future part.
- Not a marketing suite. Campaigns, newsletters, and social tools are not in scope. (Custom email templates for transactional mails are — Premium tier.)
- Not the marketplace. Guest-facing discovery ("find a restaurant near you") is Part 4+. The `marketplace_priority` flag is stored but has no dashboard surface beyond a Premium badge note.

---

# 1. Design language

## 1.1 Inherited, not redefined

All visual identity comes from `TheTafel_BrandGuidelines_v1.0.docx` and `TheTafel_UI_Spec_v1.0.docx`. This PRD does not restate them; it references them. The binding rules:

- **Raleway 900** for all display headlines and page titles. **Jost 300–700** for everything else.
- **Amber `#d4820a`** is the only accent. Deep amber `#a86205` for secondary emphasis. Night `#0f0d08` for high-contrast text. **Cream `#fdfaf5`** is the primary background.
- **No dark mode.** The dashboard is cream-first, same as every Tafel surface. (Reference dashboards reviewed during design exploration were dark-themed; The Tafel adopts their layout patterns — card-based stat tiles, generous whitespace, clear data hierarchy — in the Tafel palette.)
- **No borders for separation** — background tone shifts only. Cards sit on cream as slightly-elevated white (`#ffffff`) or tinted (`#f7f2e9`) surfaces with the standard `rounded-card` radius.
- **No icon libraries.** Every icon is hand-drawn inline SVG. The dashboard introduces roughly 25 new icons (listed in §12); all follow the existing stroke style.
- **No gradients, no pure black or white, no exclamation marks in UI copy.**
- **Status colours** (the one place the palette extends): success green `#4a7c46`, warning amber (brand amber doubles), danger red `#b3422f`, neutral grey-brown `#8c8577`. These exist already on consumer surfaces (takeaway status tones from C9.2a); the dashboard uses the same four tones everywhere. Colour is never the only signal — every status also has a label.

## 1.2 Layout system

**Phone (< 768px), the primary layout:**
- Single column. Content cards stack.
- Bottom tab bar with the four primary sections: Vandaag (Today), Reserveringen (Bookings), Bestellingen (Orders), Meer (More). Icons + labels. The active tab is amber.
- Page title as a compact header row with the restaurant name small above it.
- All tables collapse to cards (a booking row becomes a booking card).
- Sticky action buttons at the bottom of action flows (e.g. "Close tab" stays visible while reviewing tab items).

**Desktop (≥ 768px):**
- Left sidebar navigation, same structure as onboarding's sidebar for familiarity: wordmark top, nav items with the hand-drawn icons, "Need help?" block at bottom. Collapsible to icon-only rail at ≥ 768px < 1100px.
- Content area max-width 1200px, generous padding.
- Two-column layouts where a page has a primary list + detail panel (e.g. bookings list left, selected booking detail right). On phone the detail opens as a full-screen sheet instead.

**Language.** Dutch default, EN toggle in the account menu — same next-intl setup, `/dashboard` Dutch at root, `/en/dashboard` English. All routes in this PRD are shown without locale prefix.

## 1.3 The "attention first" principle

Every page answers, in this order: (1) what needs my attention right now, (2) what is the state of things, (3) what can I change. Concretely: alert strip at top (only when something needs action), then live status, then data, then settings-links. No page opens on configuration.

---

# 2. Access model — staff accounts and roles

## 2.1 The four roles

Part 1 created exactly one login per restaurant: the owner (`restaurants.user_id`, unique). The dashboard introduces staff accounts. Four roles:

| Role | Intended user | Sees | Can do |
|---|---|---|---|
| **owner** | The business owner | Everything | Everything, including billing, staff management, and closing the account |
| **manager** | Floor/general manager | Everything except billing details | Everything except: change subscription, manage staff with owner/manager roles, close account, edit legal details |
| **service** | Waiters, hosts | Today, Bookings, Orders, Tabs, Guests (read) | Act on bookings (seat, mark attended/no-show), act on orders (accept, status changes), open/close tabs, add walk-in bookings |
| **kitchen** | Kitchen staff | Order queue only (focused view) | Change order statuses (confirmed → preparing → ready) |

Notes:
- Every role's view is Dutch/English toggleable individually — a Polish kitchen worker can run the order queue in English while the owner uses Dutch.
- There is exactly one `owner` per restaurant (bound to `restaurants.user_id`). Ownership transfer is a support operation, not a self-service flow, in v1.
- Roles are per-restaurant. (Multi-restaurant accounts — one person owning two restaurants — are out of scope for v1; the schema reserves the ability via the join table but the UI assumes one restaurant per login.)

## 2.2 Staff account lifecycle

- **Invite.** Owner or manager enters an email + picks a role. The system emails an invite link (magic-link pattern, 7-day expiry, SHA-256-hashed token — same infrastructure as consumer magic links, new purpose values). The invitee sets a password on acceptance, creating a Supabase Auth user linked via the `restaurant_staff` table.
- **Deactivate.** Staff rows are soft-deactivated (`deactivated_at`), never deleted — audit trails must keep pointing at real people. A deactivated account cannot log in to the restaurant.
- **Role change.** Owner/manager can change anyone's role below their own level. Takes effect on next page load (JWT claims re-checked server-side per request, not baked into the token).
- **Shared service account (v1 pattern).** A restaurant with one shared device (the house tablet) simply keeps a single `service`-role account logged in. Per-person attribution on shared devices via 4-digit PIN quick-switch was considered and **deferred past v1** (decision D-1, 2026-07-20): the shared account covers the launch need, and owners who want per-person tracking can invite each staff member individually.

## 2.3 Authorization enforcement

- Every dashboard API route derives the acting staff member server-side from the session, loads their role from `restaurant_staff`, and checks the action against a central permission map (`lib/dashboard/permissions.ts`). No client-side-only gating.
- RLS on all dashboard-readable tables uses the `restaurant_staff` membership as its policy basis (details in the Schema doc).
- Every mutating dashboard action writes to the audit log with `actor_type='staff'` and the staff member's id — extending the existing `consumer_audit_logs` pattern with a dashboard equivalent (`dashboard_audit_logs`).

---

# 3. Navigation map

```
/dashboard                     → Vandaag (Today)            [all roles except kitchen]
/dashboard/bookings            → Reserveringen              [owner, manager, service]
/dashboard/orders              → Bestellingen (queue)       [all roles]
/dashboard/tabs                → Open rekeningen (Tabs)     [owner, manager, service]
/dashboard/guests              → Gasten                     [owner, manager, service(read)]
/dashboard/menu                → Menu                       [owner, manager]
/dashboard/analytics           → Inzichten (Insights)       [owner, manager] [Plus+]
/dashboard/settings            → Instellingen (hub)         [owner, manager]
/dashboard/settings/hours      → Openingstijden
/dashboard/settings/floor      → Zaalindeling (floor plan)
/dashboard/settings/booking    → Reserveringsregels
/dashboard/settings/ordering   → Bestellen & afhalen
/dashboard/settings/qr         → QR-instellingen
/dashboard/settings/notifications → Meldingen
/dashboard/settings/branding   → Huisstijl                  [Plus+ partial, Premium full]
/dashboard/settings/staff      → Team                       [owner, manager]
/dashboard/settings/payments   → Betalingen (Mollie status)  [owner]
/dashboard/settings/billing    → Abonnement & facturen       [owner]
/dashboard/settings/privacy    → Privacyverzoeken (GDPR)     [owner, manager]
/dashboard/settings/account    → Account
```

**Phone bottom tab bar:** Vandaag · Reserveringen · Bestellingen · Meer. "Meer" opens a sheet with Tabs, Gasten, Menu, Inzichten, Instellingen. Kitchen-role users get a single-purpose layout: the order queue full-screen, nothing else in the bar.

**Deep-linkability.** Every entity has a URL (`/dashboard/bookings/{id}`, `/dashboard/orders/{id}`, `/dashboard/tabs/{id}`). Notification emails and WhatsApps link directly to the entity.

---

# 4. Page specifications

Every page below is specified as: Purpose → Layout → Data → Actions → States → Phone behaviour.

## 4.1 Vandaag (Today) — `/dashboard`

**Purpose.** The homepage. One glance answers "how is today going and what needs me right now." This page is optimised to be opened 30 times a day for ten seconds each.

**Layout (desktop).** Top to bottom:

1. **Header row.** "Vandaag" in Raleway 900, the date beneath it in Jost. Right side: the restaurant's live-status chip (Live / Gepauzeerd) and the language toggle.
2. **Alert strip** — only rendered when at least one alert exists. Amber-tinted card listing, in priority order: Mollie connection broken (owner/manager only), failed payments today, orders in `ready` for longer than 10 minutes, tabs open past closing time, bookings pending deposit payment, WhatsApp/email delivery failures. Each alert is one line + one action link. When empty: not rendered at all — no "all clear" filler.
3. **Stat tile row** — four cards (the reference-dashboard pattern, in cream/white): **Reserveringen vandaag** (count + total covers), **Bestellingen vandaag** (count + revenue-so-far for paid orders), **Open rekeningen** (count + outstanding total), **Verwachte gasten** (covers still to arrive). Each tile: label in Jost 600 small caps, the number in Raleway 900 large, a small delta line ("3 meer dan vorige week" — only when we have last-week data). Each tile taps through to its section.
4. **Timeline — "Nu en straks."** The heart of the page. A chronological list merging today's bookings and pickup orders, from now onwards (a "Eerder vandaag" collapse holds the past). Each row: time (Jost 700), party/guest name, size or order summary, zone/table, status chip, and the single most-relevant action button inline (see Bookings/Orders actions). Auto-refreshes via polling every 60s (same polling infra as consumer status pages); a manual refresh pull exists on phone.
5. **Order queue snapshot.** The five most recent active orders with status chips, linking to the full queue.

**Data.** Bookings where `slot_time` is today; orders where `created_at` is today or `pickup_time` is today; open tabs; alert queries. All server-rendered on load, then polled.

**States.** Loading skeleton (grey-tinted card shapes, no spinners); empty day ("Nog geen reserveringen voor vandaag" with a hand-drawn empty-plate illustration and a "+ Walk-in toevoegen" action); paused restaurant (banner explaining consumer surfaces are hidden, with re-activation link to settings); error (retry card).

**Phone.** Stat tiles become a 2×2 grid. Timeline rows become cards. The alert strip is sticky under the header until dismissed (dismissal is per-day, per-device).

## 4.2 Reserveringen (Bookings) — `/dashboard/bookings`

**Purpose.** See, manage, and add bookings. The service-time list AND the lookback/lookahead archive.

**Layout.** Date navigation header (day picker defaulting to today, with ‹ › day-step arrows and a calendar popover; quick chips: Vandaag, Morgen, Dit weekend). Below: summary line ("14 reserveringen · 52 couverts · 2 wachten op aanbetaling"). Then the bookings list, grouped by service block (Lunch / Diner, derived from availability tags), sorted by slot time. Desktop: list left, detail panel right. Phone: list only; row-tap opens detail sheet.

**Booking row.** Time, guest name, party size, zone + table label(s), status chip, deposit indicator (if deposit paid: small amber coin icon), guest-note indicator (small note icon when `guest_note` non-empty).

**Booking detail (panel/sheet).** Everything about one booking: guest contact (name, phone as tap-to-call link on phone, email), party size, table assignment (editable via dropdown of free-at-that-slot tables — server-validates against the half-full rule and slot locks), duration, deposit state (amount, paid at, refund state), guest note, full status history from the audit log, and the action row.

**Actions** (all monotonic per `booking_status`; all audited; all confirm-before-destructive):
- **Markeer als aangekomen** (`confirmed → attended`) — the most-used button during service; also available inline on the Today timeline.
- **No-show** (`confirmed → no_show`) — requires confirm dialog; if a deposit was paid, the dialog states what happens ("De aanbetaling van €20 wordt ingehouden") per the restaurant's no-show policy. Fires the deposit-capture path (§8.3).
- **Annuleren** (`confirmed → cancelled`) — restaurant-side cancel. Dialog requires a reason (dropdown: guest asked by phone / restaurant closed / overbooked / other + free text). If deposit paid: automatic refund initiated (§8.3); the dialog says so. Guest gets a cancellation email (existing template, `cancelled_by='restaurant'` variant).
- **Wijzig tafel / tijd / grootte** — edit dialog. Server re-runs the full availability check (slot lock, half-full rule, zone capacity) exactly as the consumer flow does. On success, guest receives a "your booking was updated" email.
- **+ Walk-in** — quick-add dialog (party size, table, optional name; defaults: now, no contact). Creates a booking with `source='walk_in'` (new column), no guest email required, no confirmation email sent.

**Filters.** Status filter chips (Alle / Bevestigd / Aangekomen / No-show / Geannuleerd), free-text search on guest name (server-side, trigram), date-range for the archive view.

**Phone.** The "Markeer als aangekomen" action is a swipe-right on the booking card; swipe-left reveals No-show and Annuleren. Buttons remain available in the detail sheet for discoverability — swipes are accelerators, never the only path.

## 4.3 Bestellingen (Orders) — `/dashboard/orders`

**Purpose.** The live order queue for QR and takeaway. This page IS the kitchen's whole world (kitchen role sees only this, full-screen).

**Layout.** Status-column board on desktop (Nieuw / In de keuken / Klaar), a single filterable list on phone. Toggle chips: Alle / QR / Afhaal. Orders auto-appear via polling (10s interval on this page — faster than Today's 60s; matches the consumer confirmation page's polling cadence).

**Order card.** Order ref, time since placed (live-updating "4 min geleden"), type badge (QR: table label; Afhaal: pickup time), item summary (first two lines + "+3 meer"), total, payment state (Betaald / Betaalt aan tafel), item notes flagged prominently in amber when present (allergy-relevant).

**Actions** (per `order_status`, monotonic, audited):
- `pending → confirmed` — **Accepteren.** Only surfaces when `qr_auto_accept` is off or for takeaway orders per ordering settings; auto-accepted orders arrive as `confirmed`.
- `confirmed → preparing` — **In de keuken.**
- `preparing → ready` — **Klaar.** For takeaway, this fires the ready-notification (email now; WhatsApp when enabled) and stamps `ready_notified_at`. The button's confirm-microcopy says "De gast krijgt bericht dat het klaarstaat."
- `ready → served` (QR) / `ready → completed` (takeaway pickup confirmed) — **Geserveerd / Opgehaald.**
- **Annuleren** (any pre-terminal status) — reason dialog; if paid, offers refund flow (§8.2).

**Order detail.** Full item list with per-item notes, guest contact (takeaway), payment intent link-through (owner/manager), status history, refund state.

**States.** Empty queue ("Geen actieve bestellingen — tijd voor een kop koffie" with illustration). A `ready`-for->10-min order gets its card tinted amber and pinned to top (this is also the Today alert).

**Phone/kitchen mode.** Cards full-width, status-advance button is the whole card's right edge (thumb-sized). Kitchen role additionally gets a "sound on new order" toggle (simple chime, off by default, persisted per device).

## 4.4 Open rekeningen (Tabs) — `/dashboard/tabs`

**Purpose.** Settle QR pay-at-table tabs — the missing close-path from Part 2. Tabs accumulate orders during a visit; this page closes them.

**Layout.** List of open tabs: table label, opened time, order count, running total. Sorted oldest-open first. Closed-tabs archive behind a tab-switch (today + 7 days back).

**Tab detail.** Every order on the tab with items and amounts, running total, VAT summary. Primary action: **Rekening sluiten** (Close tab).

**Close-tab flow.** Confirm sheet shows the total and asks how it was settled: **Betaald aan tafel** (cash/PIN at the physical till — the normal case; The Tafel does not process this money) or **Annuleren/afboeken** (write-off, reason required, owner/manager only). On close: `tabs.status='closed'`, `closed_at`, `closed_by`, settlement method stamped; every order on the tab transitions `served → completed`; audited. Tabs are also auto-flagged (not auto-closed) in the Today alerts when still open 1h past closing time.

**Phone.** This is a checkout-adjacent flow; the close button is sticky-bottom, total always visible.

## 4.5 Gasten (Guests) — `/dashboard/guests`

**Purpose.** The restaurant's guest book. Who has visited, how often, preferences — the "my data is mine" page. [Plus+ for full access; Starter sees a teaser with upgrade prompt per the honest-claims list — "Customer database with export" is a Plus feature.]

**Layout.** Search-first: a large search field (name / email / phone), then the guest list sorted by most-recent visit. Row: name, visit count, last visit date, VIP star (Premium), marketing-consent dot.

**Guest detail.** Contact info, full visit history (bookings + orders at this restaurant only — guests are a global table but each restaurant sees only interactions with them), total spend at this restaurant (paid orders + deposits), notes field (free text, restaurant-private, e.g. "vegetarisch, altijd tafel bij het raam"), VIP toggle (Premium — writes `loyalty_tier`), marketing-consent state (read-only — consent is guest-owned, changed only by the guest).

**Export.** "Exporteer gastenlijst" — CSV download of guests with marketing consent state, scoped to this restaurant's interactions. Owner/manager only. Audited (`guests.exported` event). The export respects anonymised guests (excluded).

**Privacy boundaries (hard rules).** A restaurant sees a guest's interactions with *their* restaurant only — never cross-restaurant history. Anonymised guests appear as "Verwijderde gast" in historical bookings/orders and are excluded from search/export. Guest notes are included in the guest's own GDPR export (they are personal data) — the notes field carries a small permanent hint saying exactly that, to keep restaurants professional in what they write.

**Phone.** Search stays sticky; rows become cards.

## 4.6 Menu — `/dashboard/menu`

**Purpose.** Full menu management, replacing the onboarding menu-upload as the living editor.

**Layout.** Category list (drag-to-reorder), items within each category (drag-to-reorder). Item row: photo thumbnail, name, price, availability toggle ("86 it" — the instant out-of-stock switch), edit affordance.

**Item editor (sheet/panel).** Name NL + EN, description NL + EN, price (euros input, stored cents), photo upload (same Supabase Storage pattern as onboarding; 5MB limit, auto-resized), category, allergen tags (the 14 EU-standard allergens as toggle chips), available toggle. Server re-validates everything; price changes take effect immediately on consumer surfaces (cache invalidation via `invalidateConsumerPage(slug)` — the existing helper).

**Category editor.** Name NL + EN, reorder, availability window (optional: "Lunchgerechten alleen 11:00–15:00" — hides the category on consumer surfaces outside the window).

**The 86 flow.** The availability toggle is the most important control during service: one tap marks an item unavailable, it disappears from QR/takeaway menus within seconds (cache invalidation), and the item row shows a muted "Niet beschikbaar" state. No confirm dialog — it must be instant; the toggle itself is the undo.

**States.** Menu with zero items (restaurants that skipped menu upload — reservations-only who later enable QR): full empty-state onboarding into the editor.

**Phone.** Reordering via drag handles (not long-press — conflicts with scroll). The 86 toggle is on the card face, not buried in the editor.

## 4.7 Inzichten (Insights) — `/dashboard/analytics` [Plus+]

**Purpose.** Answer the owner's real questions: How busy are we? When? What sells? Are no-shows hurting us? Honest, simple analytics — not vanity dashboards.

**Tier gating.** Starter: page shows a preview (blurred sample chart + feature list + upgrade CTA). Plus: the core set below. Premium: adds the revenue set.

**Core set (Plus).**
- **Bezetting** — bookings + covers per day, last 30 days, bar chart. Weekday-pattern summary ("Vrijdag is je drukste dag").
- **Reserveringspatronen** — lead time distribution (how far ahead guests book), party-size distribution, cancellation + no-show rates with month-over-month trend.
- **Bestellingen** — QR vs takeaway order counts, average order value, busiest ordering hours.
- **Top gerechten** — most-ordered items, ranked, with count. And the bottom five ("Overweeg deze te vernieuwen of te schrappen").

**Revenue set (Premium — "Advanced revenue analytics").**
- Revenue per day/week/month across all paid flows (QR pay-now, takeaway, deposits kept), VAT-split totals aligned with what Mollie settles.
- Revenue per zone and per table (QR orders), revenue per menu category.
- No-show cost estimate (no-shows × average spend proxy) — clearly labelled as an estimate.

**Implementation principles.** All charts are hand-styled (recharts with brand tokens — no default chart-library look). Every number is computed from the restaurant's own real rows; no sampling, no estimates except where labelled. Date-range picker: 7 / 30 / 90 days / custom. Data is queryable live (no pre-aggregation) until scale demands materialised views — the schema doc reserves a `dashboard_stats_daily` rollup table for that day, unused in v1.

**Phone.** Charts render full-width, one per screen-height; horizontal scroll is never used.

## 4.8 Instellingen (Settings hub) — `/dashboard/settings`

A hub page of cards linking to each settings section, each card showing a one-line current-state summary ("Openingstijden — Ma–Zo 11:00–22:00", "Team — 4 accounts"). Sections:

### 4.8.1 Openingstijden — `/settings/hours`
The onboarding Step 3 editor, reused as a living editor: per-day open/close blocks with service-scope tags (all / reservations / takeaway / QR) and lunch/dinner/brunch tags — writing to the same `availability` table. Plus: **Uitzonderingen** (exception dates) — holiday closures and special hours on specific dates (new `availability_exceptions` table). Consumer booking/ordering flows respect exceptions (server-side availability check extension). Changing hours triggers a confirm when existing future bookings fall outside the new hours, listing the affected bookings ("3 reserveringen vallen buiten de nieuwe tijden — bekijk ze eerst").

### 4.8.2 Zaalindeling (Floor plan) — `/settings/floor`
The onboarding Step 2 zones-and-tables editor, reused. Guards that onboarding didn't need: deleting a table with future bookings is blocked with a list of them; deleting a table with an open tab is blocked; QR-enabled tables warn that their QR code dies with them. Table edits (seats, zone moves) re-validate future bookings against the half-full rule and flag conflicts rather than silently breaking them.

### 4.8.3 Reserveringsregels — `/settings/booking`
Onboarding Steps 4–6 settings as a living editor: min lead time, max party size online, booking window days, slot duration, no-show protection (enabled, threshold, amount, windows), guest-experience settings. Every change server-validated; changes affect only new bookings.

### 4.8.4 Bestellen & afhalen — `/settings/ordering`
Onboarding Step 7 settings: takeaway on/off, prep time (the "ready in X minutes" promise — editable here per the deferred-items list), scheduled-orders toggle, min order value.

### 4.8.5 QR-instellingen — `/settings/qr`
Step 9–10 settings: auto-accept toggle, item notes toggle (reads/writes the Part-2 `qr_item_notes_enabled` column; this page is where the Part-1 duplicate column finally gets migrated and dropped), menu language, accent colour, pay-now/pay-at-table toggles. QR code management: per-table QR preview/download, regenerate token (kills the old code — double confirm), download-all ZIP.

### 4.8.6 Meldingen — `/settings/notifications`
Which events notify the restaurant and where: new booking, cancellation, new order, failed payment → each toggleable per channel (email now; WhatsApp when the restaurant's number is verified and the platform flag is on). Restaurant notification email defaults to the owner's; extra recipient addresses can be added.

### 4.8.7 Huisstijl (Branding) — `/settings/branding`
Plus: brand colours on the widget (the `brandColors` Plus feature). Premium: the brand-pack uploader (logo, colours, typography preferences) feeding the QR Premium design workflow — uploads to Storage, flags the Tafel team for the custom-design fulfilment. Clear expectation copy: "Ons team verwerkt je huisstijl binnen 5 werkdagen in je QR-kaarten."

### 4.8.8 Team — `/settings/staff`
The §2 staff management UI: member list (name, role, last active), invite flow, role changes, deactivation.

### 4.8.9 Betalingen — `/settings/payments` [owner]
The Mollie connection surface — the "should surface this instead of failing silently" fix from the C9.4 audit. Shows: connection status (Verbonden / Actie nodig / Niet verbonden / Verlopen — mapping `mollie_status` + token validity, checked live against Mollie on page load), what each state means for guests ("Gasten kunnen nu niet vooruitbetalen bij afhalen"), and the **Opnieuw verbinden** button into the Mollie OAuth flow (the onboarding Step 11 flow, reused). A broken connection also fires the Today alert and an owner email (daily max 1).

### 4.8.10 Abonnement & facturen — `/settings/billing` [owner]
Current tier + QR plan, trial countdown when in trial ("Nog 31 dagen gratis — daarna €47 per maand"), payment method (via Mollie mandate — masked, replaceable), invoice history (downloadable PDFs — the existing pdf-lib infra), upgrade/downgrade flow (upgrade immediate + prorated per Mollie; downgrade at period end; Premium→Plus downgrade warns about losing QR Premium/WhatsApp/VIP per the existing downgrade-notice pattern). Cancellation: end-of-period, with a required-reason survey, clear statement of what happens to data (retained per retention policy, restaurant unpublished).

### 4.8.11 Privacyverzoeken — `/settings/privacy`
The restaurant-side GDPR view (deferred item). Read-only list of data-export and deletion requests from guests that touch this restaurant's data: request date, type, status (fulfilled automatically by the Part-2 flows). No action needed from the restaurant — this page exists for transparency and for the restaurant's own GDPR-accountability records. Includes a short plain-language explainer of the restaurant's processor/controller relationship with The Tafel (copy reviewed by the lawyer alongside the DPA).

### 4.8.12 Account — `/settings/account`
Owner/staff self-service: name, email (re-verification flow), password change, language preference, log out everywhere.

---

# 5. Restaurant status control — pause and live

A single owner/manager control (on Today's header and in Settings): **Pauzeer restaurant**. Pausing sets a `paused_at` timestamp (new column; `status` stays `live` — pause is not a status regression). While paused: consumer surfaces show the restaurant's "closed" state (bookings/ordering disabled with a friendly message), existing bookings stand (the restaurant handles them), the dashboard banner shows paused-state with one-tap resume. Use cases: illness, private events, holidays (long closures better served by availability exceptions — the pause dialog says so).

---

# 6. Notifications to the restaurant

In-dashboard (the Today alert strip + per-page pinning) is the primary channel. Email (and later WhatsApp) for the events in §4.8.6 using the existing dispatcher infra with new restaurant-facing templates (same wordmark header pattern). Web push is explicitly out of scope for v1 (PWA push on iOS remains unreliable; revisit in a later part). The new-order chime (§4.3) covers the during-service case where polling + sound beats push anyway.

---

# 7. Mobile app note

The Part-1 plan named a React Native + Expo app. The dashboard ships as a responsive web app first — it is the requirement for launch. The RN app becomes a thin wrapper around the same views in a later part; nothing in this PRD assumes native APIs beyond what responsive web provides. (The one native-only nicety — push notifications — is already scoped out of v1 per §6.)

---

# 8. Money flows in the dashboard

## 8.1 What the dashboard can do with money
Three things only: refund guest payments (QR/takeaway), capture-or-refund booking deposits on no-show/cancel, and manage the restaurant's own subscription. All Mollie calls server-side, all idempotent, all audited, all monotonic on `payment_intents`.

## 8.2 Refunds (QR + takeaway orders)
On an order with `payment_intents.status='paid'`: owner/manager sees **Terugbetalen** in the order detail. Full refund only in v1 (partial refunds = the `partially_refunded` enum value stays reserved). Confirm dialog states amount + "Terugbetaling duurt 1–3 werkdagen via Mollie." Server: Mollie refund call → `payment_intents` → `refunded`, order → `refunded`, guest email ("Je betaling is teruggestort"), audit. Failure surfaces honestly ("Terugbetaling mislukt — probeer het later opnieuw of neem contact op met support") and is retryable — never silently swallowed.

## 8.3 Deposits — completing the C9.1 story
The dashboard part finishes the deposit linkage that C9.1 narrowed. Scope here: (a) the consumer deposit flow gets wired end-to-end (frontend calls start-deposit, waits for payment, passes `deposit_intent_id` into booking create — the Part-3-deferred spec), (b) webhook handles `purpose='deposit'`, (c) `resolveDepositForBooking` helper exists, and (d) the dashboard actions consume it: **No-show** → capture (deposit already collected — it is simply kept; the action records the decision and notifies the guest per policy), **restaurant cancel / guest cancel in policy window** → refund via the §8.2 machinery. Both directions of the metadata linkage from the original C9.1 design are implemented here.

## 8.4 Subscription billing enforcement
The deferred "billing-suspended restaurants can still take bookings" gap gets its product decision here: when a subscription payment fails, a **14-day grace period** starts (owner email + persistent dashboard banner, day 1 / 7 / 12 reminders). During grace: everything works. After grace: consumer write surfaces pause automatically (same UX as manual pause, distinct banner + audit reason `billing_suspended`), existing bookings stand, dashboard remains fully accessible (a restaurant must always be able to reach billing settings to fix payment). Resolving payment un-pauses immediately. The doorman (`assertConsumerWriteAllowed`) gains the subscription-health check — closing PART_3_DASHBOARD_DEFERRED item 2.

---

# 9. Empty states, errors, and honesty

- Every list has a designed empty state: hand-drawn illustration + one line + one action. No blank screens.
- Every failed action states what failed and what to do, in plain Dutch. No error codes shown to restaurants (codes go to the audit log).
- No fake data anywhere: no sample charts presented as real, no placeholder stats. Tier-gated previews are explicitly labelled "Voorbeeldweergave."
- Deltas and comparisons render only when real comparison data exists (a restaurant live for 4 days sees no "vs last month").

---

# 10. Performance and reliability targets

- Today page: first meaningful render < 1.5s on 4G phone; polling every 60s (Today) / 10s (Orders) with backoff on failures.
- All dashboard writes: optimistic UI where safe (status advances), never for money actions (refunds/deposits show explicit pending → done states).
- Slot-lock and monotonic-transition guards from Part 2 apply unchanged to every dashboard write that touches the same rows.
- The dashboard must remain usable during a Vercel/Supabase degradation for read-heavy flows: last-good data stays rendered with a "Verbinding verbroken — opnieuw proberen" strip rather than blanking.

---

# 11. Launch gating — what "dashboard part done" means

The dashboard part is complete when: all pages in §4 shipped and Playwright-tested (extending the Part-2 suite with staff-authenticated flows); §8 money flows verified against Mollie (the real-OAuth e2e finally possible — the owner connects a real Mollie account through §4.8.9); §2 roles enforced by RLS + permission map and tested per role; PART_3_DASHBOARD_DEFERRED.md fully drained (every item shipped here or explicitly re-deferred with reason); `/onboarding/live` replaced by a redirect to `/dashboard`.

---

# 12. New hand-drawn icons required

Calendar-day, clock-arrival, chair, plate, chef-hat, receipt, coins, refund-arrow, guest-book, star (VIP), pencil, drag-handle, eye/eye-off (86), chart-bars, chart-line, gear, team, bell, pause, play, shield (privacy), invoice, link (Mollie), warning-triangle, check-circle, walk-in-door. All in the established stroke style; delivered as inline SVG components in `components/dashboard/icons/`.

---

# 13. Resolved decisions (Ankur, 2026-07-20)

1. **PIN quick-switch** — **deferred past v1.** Shared service-role account covers shared devices at launch.
2. **Grace period** — **14 days confirmed.**
3. **Kitchen chime** — **build it.** Off by default, per-device toggle.
4. **Starter guest-database** — **teaser with upgrade CTA.** Blurred preview labelled "Voorbeeldweergave."
5. **Walk-in bookings** — **do not count** against Starter's 30-booking monthly limit. The limit applies only to online bookings placed through The Tafel's consumer surfaces (`source` ≠ `walk_in`).

---

*End of TheTafel_Dashboard_PRD_v1.0*
