# The Tafel — Product Requirements Document
## Part 1 of 3 — Restaurant Owner Onboarding

**Document:** TheTafel_Onboarding_PRD_v1.0
**Scope:** Web-based restaurant onboarding flow (Netherlands only)
**Status:** Source of truth. Replaces all earlier onboarding PRDs.
**Companion file:** `TheTafel_Onboarding_Schema_v1.0.sql` — the full database schema referenced throughout this document.

---

## 0. How to read this document

This PRD is the complete specification for the restaurant onboarding experience of The Tafel. It does **not** contain a build plan — that is a separate document. It does not cover the restaurant dashboard (Part 2) or the diner-facing pages (Part 3) — those are separate PRDs.

This document is organised as follows. Sections 1–3 explain what The Tafel is, who it is for, and the high-level shape of onboarding. Sections 4–6 specify every onboarding screen in detail. Sections 7–10 cover the architecture: database, security, payments, third-party integrations. Section 11 covers operational concerns — concurrency, performance, monitoring. Section 12 covers GDPR and legal. Section 13 lists every reusable asset from the C.1–C.4 work and what is being thrown away. Section 14 is the glossary.

Anywhere this document says "the system," it means the onboarding system specifically — not the restaurant app or the diner-facing pages.

---

# 1. Product overview

## 1.1 What The Tafel is

The Tafel is a Dutch restaurant operations platform. It gives restaurants three customer-facing services they can switch on individually or together:

1. **Reservations** — guests book tables online.
2. **Takeaway** — guests order food online for pickup, paying online up front.
3. **QR ordering** — guests at a table scan a QR code, browse the menu on their phone, order, and pay online or at the table.

A fourth service, **Delivery**, is shown in the interface as a future option but is not yet active.

The platform is positioned as a fairer alternative to high-commission incumbent platforms: a flat monthly subscription with minimal commission only on marketplace-driven transactions, instead of double-digit commission on every booking or order.

## 1.2 Two sides of the platform

The Tafel has two principal user-facing surfaces:

- **The website (thetafel.nl)** — used by the restaurant for onboarding, used by diners for booking / takeaway / QR menus. Public, mobile-friendly.
- **The restaurant web app** — used by restaurant owners and staff for daily operations after onboarding. Browser-based, accessible from desktop, tablet, or phone. Designed primarily for landscape view on tablets; phones in portrait orientation show a polite "please switch to landscape or use desktop view" interstitial.

There is no native mobile app at launch. The decision to keep the operations tool browser-based avoids App Store and Play Store overhead in the early months and lets a restaurant log in from any device.

## 1.3 What this document covers

This PRD covers **only the onboarding flow**: the website-based process a restaurant owner completes to set up The Tafel for their business. It begins at signup and ends when the restaurant reaches the "you are live" screen.

The dashboard (where restaurants operate the business day-to-day) and the diner-facing pages (where the public interacts with the booking widget, takeaway page, and QR menu) are documented separately in Part 2 and Part 3.

## 1.4 The brand

The wordmark is rendered as two stacked lines: "THE" small in amber above "Tafel" large in dark earth, Raleway 900. In running text the product is referred to as "The Tafel." Throughout the onboarding flow, the wordmark appears in the sidebar.

Colors, fonts, and design rules are taken from the existing brand guidelines and are not redefined here. The relevant constants:

- Primary background: cream `#fdfaf5`
- Card / soft surface: warm `#f0e8d8`
- Primary text: earth `#1e1508`
- Secondary text: stone `#9c8b6a`
- Accent: amber `#d4820a`
- Display typeface: Raleway 900
- Body typeface: Jost 300–700
- Icons: custom inline SVG, never an icon library
- No dark mode on any owner- or diner-facing surface

## 1.5 What "looks AI-generated" means and why it is forbidden

The Tafel must not look like a generic AI-generated interface. This rules out the following, throughout the onboarding flow:

- Emojis substituting for icons in feature cards (the demo's house-of-emoji approach is for illustration only)
- "✨ AI" badges scattered through the interface
- Dashed-border drop zones used for non-upload purposes
- Generic rounded-card grids with three or four identical cells
- Placeholder copy that reads like ChatGPT output (overuse of em-dashes, "let's", "your journey starts here")
- Perfect symmetric pastel palettes
- Stock-photo-style mood imagery in onboarding chrome

Acceptable design idioms include: custom-drawn inline SVG icons matching the existing brand mark style; type-led screens that rely on Raleway and Jost rather than decoration; restrained colour use with amber as the only accent; copy written in clear, slightly formal Dutch (and matching English).

The visual specification of each screen in Section 4 follows these constraints.

---

# 2. The three services and the conditional wizard

The fundamental structural decision of the onboarding flow is **service selection drives everything that follows**. A restaurant that picks only Reservations sees a shorter wizard than one that picks all three.

## 2.1 Services and their flags

Each restaurant has three independent boolean settings:

- `service_reservations_enabled`
- `service_takeaway_enabled`
- `service_qr_enabled`

A fourth, `service_delivery_enabled`, exists in the schema but is hard-coded to `false` for all restaurants and is non-selectable in the UI.

At least one of the three must be `true` to proceed past Step 0.

## 2.2 The 14 onboarding steps and which services trigger them

The full wizard has 14 numbered steps (after the Step 0 service picker). Each step is tagged with one or more services. A step is shown to the restaurant only if at least one of its tagged services is enabled.

| # | Step | Reservation | Takeaway | QR |
|---|---|---|---|---|
| 1 | Verify your business (KVK) | ✓ | ✓ | ✓ |
| 2 | Floor plan | ✓ | | |
| 3 | Opening hours | ✓ | ✓ | ✓ |
| 4 | Booking rules | ✓ | | |
| 5 | No-show protection | ✓ | | |
| 6 | Guest experience | ✓ | | |
| 7 | Online ordering settings | | ✓ | |
| 8 | Menu upload | | ✓ | ✓ |
| 9 | QR setup & plan | | | ✓ |
| 10 | QR codes | | | ✓ |
| 11 | Connect payments (Mollie) | ✓ | ✓ | ✓ |
| 12 | Subscription | ✓ | ✓ | ✓ |
| 13 | Contract & e-sign | ✓ | ✓ | ✓ |
| 14 | Review & go live | ✓ | ✓ | ✓ |

Step numbering shown to the restaurant is dynamic: if a restaurant has not enabled QR ordering, the steps that follow the skipped QR steps renumber to match. A Reservations-only restaurant sees 10 steps (1, 2, 3, 4, 5, 6, 11, 12, 13, 14) but they are displayed as "Step 1 of 10" through "Step 10 of 10."

A Reservations-only restaurant therefore does not see the menu upload step, even though the menu upload is shared with QR. A Takeaway-only restaurant does not see the floor plan step.

## 2.3 Step 0 — the service picker

Before the wizard begins, the restaurant chooses services on a screen labelled "Step 1 of 2 — Choose your services." This is the same numbering convention used in the design demo and is preserved deliberately: it sets the expectation that the wizard itself begins after the choice.

The picker shows four cards: Reservations, Takeaway, QR ordering, Delivery. Delivery is visibly disabled with a "Coming soon" tag and cannot be selected. A footnote ("Set up all three services — recommended") encourages but does not force broad selection.

After selection, "Set up services" advances to Step 1 of the dynamic wizard.

---

# 3. The shape of the onboarding flow

This section describes the chrome and behaviour that surrounds every screen.

## 3.1 Layout

Onboarding uses a two-pane layout at the desktop breakpoint:

- **Left sidebar (~280 px wide, dark `#1e1508` background):**
  - "THE TAFEL — RESTAURANT SETUP" two-line wordmark at the top
  - NL / EN language toggle
  - Selected services as small coloured chips (Booking amber, Pickup green, QR purple)
  - The list of step labels, numbered, with status icons (current step amber, completed steps amber with checkmark, future steps muted)
  - "Need help? Our team gets you live within 60 minutes — free."
  - "Book a setup call" button at the bottom

- **Right main pane (cream `#fdfaf5` background):**
  - A thin amber progress bar at the very top, full width, showing percentage complete
  - "Step X of Y — Service tag" eyebrow text in amber
  - The screen's heading in Raleway 900
  - A short sub-heading in Jost 300 (one or two lines)
  - The screen's main content
  - A footer with Back button (left), step indicator centre, and Continue / Next button (right amber)

At narrower viewports the sidebar collapses behind a hamburger menu and the layout becomes single-column.

## 3.2 Progress and saving

Every field in every step autosaves to the database on blur (the same draft-route pattern used in the C.1–C.4 implementation, extended). A small "Saved" indicator briefly appears below the field. If a network call fails, the field is highlighted and the restaurant sees a non-blocking "Couldn't save — retrying" message; the system retries with exponential backoff.

The restaurant can close the tab and return any time. On return, after authentication, the system resolves the latest step they had completed and redirects them there. Earlier steps can be revisited at any time via the sidebar.

## 3.3 Navigation

- **Continue** advances if the current step's required fields are valid; it is disabled and amber-pale (`rgba(212,130,10,0.5)`) until all required fields validate.
- **Back** moves to the previous visible step. It is hidden on Step 1.
- Sidebar steps are clickable for any step the restaurant has reached at least once, allowing free movement.
- Closing the browser leaves the draft intact.

## 3.4 Language

NL is the default for every screen, label, validation message, error, email, and SMS. EN is selectable via the toggle in the sidebar. Selection persists across sessions, stored on the user's profile. All copy in this PRD is shown in English for clarity; Dutch translations are maintained in a parallel translation file and are not duplicated here.

## 3.5 Validation philosophy

Validation runs:
- **Client-side, on blur**, for the user's immediate feedback (format, length).
- **Server-side, on save**, for authority (uniqueness, KVK lookups, etc.).

No field is ever trusted client-side. Every server route revalidates the entire payload.

## 3.6 Error handling

Errors fall into three categories:

- **Field errors** — shown inline beneath the field, in `#dc2626`, Jost 500.
- **Step errors** — non-blocking banner at the top of the main pane in soft red.
- **System errors** — full-screen error page with a contact link and a retry button. Reserved for catastrophic failures (database unavailable, authentication broken). Onboarding state is preserved and the restaurant can reload.

The system never shows a stack trace or technical error code to the restaurant. All such information is logged server-side.

---

# 4. The onboarding steps in detail

This section specifies every step's purpose, fields, validation, behaviour, and the database columns that back it. The companion SQL file contains the full table definitions.

For each step the format is: **Purpose → Inputs → Validation → Server behaviour → Data → Continue criteria.**

## Step 0 — Choose your services

**Purpose.** Determine which onboarding steps the restaurant sees and which services are enabled at launch.

**Inputs.** Three checkbox-style large cards (Reservations / Takeaway / QR) plus one disabled card (Delivery).

**Validation.** At least one of the three active cards must be selected.

**Server behaviour.** Creates the `restaurants` row if it does not exist (with `status = 'onboarding'`). Sets `service_reservations_enabled`, `service_takeaway_enabled`, `service_qr_enabled`. Sets `current_onboarding_step` to 1.

**Data written.** `restaurants.service_*_enabled`, `restaurants.current_onboarding_step`, `restaurants.user_id`, default `name` placeholder ("Mijn restaurant"), default `slug` (`draft-{uuid}`).

**Continue criteria.** At least one selected.

## Step 1 — Verify your business (KVK)

**Purpose.** Identify the restaurant against the Dutch Chamber of Commerce register (Kamer van Koophandel — KVK).

**Inputs.**
- KVK number (8 digits) with "Look up KVK" button
- After lookup: an autofilled card showing legal name, status, founded year, address, city, director, email (if public), phone (if public), SBI code
- "Edit if needed" form below the card with: display name (the public-facing name, may differ from legal name), trade name confirmation, cuisine, public phone, public email, website (optional), public address

The implementation of the KVK lookup is unchanged from the C.2 implementation: a server-side proxy (`/api/kvk/search`, `/api/kvk/profile`) hits the KVK Zoeken and Basisprofiel APIs with the `KVK_API_KEY` environment variable, with Upstash caching and rate limits.

**Validation.**
- KVK number: 8 numeric digits
- Display name: required, ≤ 120 chars
- Public phone: optional, Dutch phone format if present
- Public email: optional, valid email
- Website: optional, valid URL with scheme
- SBI code: must be in range 56.x (restaurants and food service); rejection message shown for non-restaurant SBIs with an option to contact support

**Server behaviour.**
- Persists `kvk_number` with a UNIQUE constraint — if another restaurant has already claimed this KVK, return 409 with a "this KVK is already linked to another account" message.
- Stores all KVK-returned fields in `kvk_*` columns for audit / Mollie verification later.
- Stores display-name and trade-name in the `restaurants` table proper.
- Records the SBI code; if not 56.x, blocks completion of this step.

**Data written.** `restaurants.kvk_number`, `restaurants.legal_name`, `restaurants.display_name`, `restaurants.trade_name`, `restaurants.legal_form`, `restaurants.sbi_code`, `restaurants.legal_address_*`, `restaurants.website`, `restaurants.contact_phone`, `restaurants.contact_email`, `restaurants.cuisine_type`, and `restaurants.kvk_verified_at` (timestamp).

**Continue criteria.** KVK lookup succeeded, SBI is restaurant-eligible, display name filled.

## Step 2 — Floor plan (Reservations only)

**Purpose.** Set up the seating layout for capacity calculations, and seed the tables that will later be used for QR codes if QR is also enabled.

**Inputs.**
- Zones — at minimum one zone is required. Defaults: "Binnenzaal" (Indoor) created automatically. Owner can add zones (e.g. "Terras", "Bar") with a "+ Zone" button.
- Tables within each zone — added by clicking a table-size button (2p / 4p / 6p / 8p / 10p) which adds a labelled table (T1, T2, T3...) to the active zone. Each table can be removed via an X icon.
- **Occupancy duration** — single dropdown (default 90 min). Options: 45, 60, 75, 90, 105, 120, 150 min, or "Per party size" which opens a small grid mapping party-size → duration.
- **Turnover buffer** — dropdown (default 15 min). Options: 0, 10, 15, 20, 30 min. This is the gap between two consecutive bookings on the same table.

Above the zones: live summary tiles showing **total tables, total seats, total zones, max guests per shift**. These update as the owner builds the layout.

**Validation.**
- At least one zone with at least one table.
- At least one table with seats ≥ 2.
- Occupancy duration > 0.

**Server behaviour.**
- Writes `zones` and `restaurant_tables` rows. Both have hard cascading deletes on `restaurant_id`.
- Each table is assigned a stable UUID; the human-readable label (T1, T2…) is auto-generated but editable.
- Per-party-size durations stored as JSONB if used.

**Data written.** `zones` table (one row per zone), `restaurant_tables` table (one row per table), `restaurants.occupancy_duration_minutes`, `restaurants.occupancy_duration_by_party` (JSONB, nullable), `restaurants.turnover_buffer_minutes`.

**Continue criteria.** At least one zone with at least one table; occupancy duration set.

## Step 3 — Opening hours (all services)

**Purpose.** Define the days and times the restaurant operates. Used by all three services. Booking slots, takeaway pickup times, and QR ordering availability all derive from these hours.

**Inputs.** Seven rows (Monday through Sunday — labelled with Dutch abbreviations Ma, Di, Wo, Do, Vr, Za, Zo).

For each day:
- On/off toggle
- Open time (HH:MM, 24-hour, default 12:00)
- Close time (HH:MM, 24-hour, default 22:00) — close time after midnight is supported as e.g. "01:00" meaning "01:00 the next day"
- Service tag pills: Brunch / Lunch / Dinner — multi-selectable, optional. Used purely as labels for the restaurant's own analytics; do not affect bookings.

Below the seven rows:
- **Slot interval** — dropdown (default 30 min). Options: 15, 30, 45, 60 min. This is the granularity of booking time slots.
- **Kitchen closes (offset before closing time)** — dropdown (default 30 min). Last takeaway / QR order can be placed this many minutes before closing.

**Per-service hours override (toggle):** by default, all three services share these hours. A toggle "Use different hours per service" expands the screen into three sets of seven-day rows. (See FAQ note in §4.4 — most restaurants leave this off.)

**Validation.**
- At least one day enabled.
- For each enabled day, close time after open time (with the after-midnight convention applied).
- Slot interval > 0.

**Server behaviour.**
- Replaces all existing `availability` rows for this restaurant (delete-then-insert under one transaction).
- If per-service override is on, writes separate rows with `service_scope` distinguishing them.

**Data written.** `availability` rows (one per enabled day per service scope), `restaurants.slot_interval_minutes`, `restaurants.kitchen_closes_offset_minutes`.

**Continue criteria.** At least one day enabled.

## Step 4 — Booking rules (Reservations only)

**Purpose.** Define the constraints the booking engine enforces.

**Inputs.**
- **Minimum lead time** — dropdown. How long before a booking time the cutoff is. Options: Off, 30 min, 1 hour (default), 2 h, 4 h, 24 h, "Same day cutoff at HH:MM."
- **Maximum party size** — dropdown. Options: 2 / 4 / 6 / 8 (default) / 10 / 12 / 15 / 20 / "No limit." Bookings above this size must contact the restaurant directly.
- **Booking window** — how far in advance bookings open. Dropdown: 7 / 14 / 30 / 60 / 90 (default) / 180 / 365 days.
- **Maximum guests per slot** — optional cap on total guests booked across all tables in any one slot. Dropdown: "No limit" (default), 10, 15, 20, 25, 30, 40, 50, or custom.
- **Waitlist** — toggle (default on). When the restaurant is full, guests can join the waitlist.
- **Guest zone preference** — toggle (default on). When on, guests see zone options during booking and can express a preference.

There is no auto-confirm toggle — every booking is auto-confirmed by design (see §11.1).

**Validation.** All required fields have valid values. Maximum party size ≥ 2 if set. Booking window ≥ 1 day. Max guests per slot, if set, ≥ 2.

**Data written.** All into the `restaurants` table: `min_lead_time_minutes`, `max_party_size`, `booking_window_days`, `max_guests_per_slot` (nullable), `waitlist_enabled`, `guest_zone_choice_enabled`.

**Continue criteria.** All required values present.

## Step 5 — No-show protection (Reservations only)

**Purpose.** Configure which no-show protections are active.

**Inputs.** Six option tiles arranged in a 3×2 grid. Each tile shows an icon, the name, a one-line description, and a state (selected / unselected / disabled).

| Tile | Status at launch | Description |
|---|---|---|
| Reminders (email + WhatsApp) | Available | Default on. Reminder sent 24h and 2h before booking. Per-message cost shown. |
| Reconfirmation | Available | Default off. Guest must confirm via a link 24h before. If not confirmed, booking lapses. |
| Prepaid bookings | Available | Default off. Guest must pay a deposit at booking; refunded on attendance, kept on no-show. Mollie required. |
| Credit-card guarantee | Disabled — "Coming soon" | Greyed out, not selectable. |
| AI no-show predictor | Disabled — "Coming soon" | Greyed out, not selectable. |
| Ban policy | Removed | Not shown in the UI at all. (The earlier demo had this; it's been cut.) |

WhatsApp reminders are only available on the Premium subscription tier (see §4.12). When the restaurant is not yet on Premium, the WhatsApp option within the Reminders tile is shown as "Available with Premium plan" — the email reminder is included on all tiers.

**Per-message cost.** Shown in small print near the Reminders tile: "Reminders are free on all plans. WhatsApp reminders require Premium and use your monthly WhatsApp allowance — overage is €0.05 per message."

**Validation.** Prepaid bookings require Mollie connection (Step 11) to be eventually configured — if not, this option is disabled with a note saying so.

**Data written.** `restaurants.noshow_reminders_email_enabled`, `restaurants.noshow_reminders_whatsapp_enabled`, `restaurants.noshow_reconfirmation_enabled`, `restaurants.noshow_prepaid_enabled`, `restaurants.noshow_prepaid_amount_cents` (if prepaid on).

**Continue criteria.** None — all options are optional.

## Step 6 — Guest experience (Reservations only)

**Purpose.** Set the wording and questions for the guest's booking experience.

**Inputs.**
- **Confirmation message template** — textarea with placeholders. Variables: `{naam}`, `{restaurant}`, `{datum}`, `{tijd}`, `{gasten}`, `{adres}`. Default template provided in NL and EN. Live preview to the right.
- **Booking questions** — toggleable list. Default questions: Allergies, Special occasion (birthday/anniversary), Special requests (free text). Each can be toggled on/off; default on. The restaurant cannot add custom questions in onboarding (this can come later).

**Validation.** Template must contain at least the variable `{restaurant}`. Otherwise non-blocking.

**Data written.** `restaurants.confirmation_template_nl`, `restaurants.confirmation_template_en`, `restaurants.booking_question_allergies`, `restaurants.booking_question_occasion`, `restaurants.booking_question_requests`.

**Continue criteria.** None — defaults work.

## Step 7 — Online ordering settings (Takeaway only)

**Purpose.** Configure takeaway behaviour.

**Inputs.**
- **Prep time** — how long the kitchen needs from order to ready. Dropdown: 10 / 15 / 20 (default) / 25 / 30 / 45 / 60 min.
- **Minimum order** — optional. €0 default. Currency input.
- **Pickup slot interval** — how often a new pickup time becomes available. Dropdown: 10 / 15 (default) / 20 / 30 min.
- **Accept online orders** — toggle (default on). The restaurant can switch this off later from the app to pause takeaway.
- **Allow item notes** — toggle (default on). Lets customers add notes ("no onions").
- **Scheduled orders** — toggle (default off). Lets customers schedule a pickup time for later in the day or future days within the booking window.

**Validation.** Minimum order ≥ 0. All others have valid defaults.

**Data written.** `restaurants.takeaway_prep_time_minutes`, `restaurants.takeaway_min_order_cents`, `restaurants.takeaway_slot_interval_minutes`, `restaurants.takeaway_accepting_orders`, `restaurants.takeaway_item_notes_allowed`, `restaurants.takeaway_scheduled_orders_allowed`.

**Continue criteria.** None — defaults work.

## Step 8 — Menu upload (Takeaway or QR)

**Purpose.** Receive the restaurant's menu source material so The Tafel design team can build the designed menu within 2 business days.

**Inputs.**
- **Menu file upload** — file picker (drag-drop). Accepts PDF, JPG, PNG, WebP, max 20 MB. Multiple files allowed (one upload per file, up to 5 files total — for restaurants with separate drink menus etc.).
- **Cuisine description** — short textarea: "Tell us about your food and atmosphere — what should the menu design feel like?" Optional, recommended.
- **Photos to include** — optional file upload for the restaurant's own existing photos (interior, food). Same accepted types, max 20 MB each, up to 10 files.
- **Design preferences** — optional textarea: "Any specific colours, fonts, or design references?" Optional.

There is **no AI extraction at this stage.** The Tafel design team manually digitises the menu over 1–2 business days after onboarding. The restaurant only uploads source material.

**Single menu vs separate menus (Takeaway + QR both enabled).** A toggle: "Use the same menu for both takeaway and QR ordering?" — default **on**. When on, the same menu items are used for both, but each item has independent per-channel visibility toggles set by the restaurant later. When off, the restaurant uploads separate menu sources for takeaway and QR.

**Validation.** At least one menu file uploaded.

**Server behaviour.**
- Files uploaded to Supabase Storage in the `restaurant-menu-sources` bucket, path `{restaurant_id}/{upload_id}.{ext}`.
- A `menu_source_uploads` row is created per file with metadata (filename, size, type, channel).
- Storage bucket has RLS: only the owner can upload to their folder; The Tafel internal team (a special role) has read access.

**Data written.** `menu_source_uploads` rows, `restaurants.menu_same_for_both` (boolean), `restaurants.menu_cuisine_description`, `restaurants.menu_design_preferences`.

**Continue criteria.** At least one menu file uploaded.

## Step 9 — QR setup & plan (QR only)

**Purpose.** Configure QR-table behaviour and select the QR setup plan.

**Inputs.**

**QR plan selection — two cards:**

| Plan | Price | Includes |
|---|---|---|
| **QR Basic** | €119 one-time | Basic menu design + table stickers, up to 20 tables. Extra tables €11 each. |
| **QR Premium** | €269 one-time | Fully custom menu design + plastic-built beautiful QR cards, 1-year replacement warranty, up to 20 tables. Extra tables €11 each. **Requires Premium subscription tier.** |

Selection card-style. The Premium card displays "Requires Premium subscription" in small print and is greyed out until the restaurant is on or selecting the Premium tier in Step 12. (If the restaurant later downgrades from Premium, the warranty becomes void but the cards stay.)

**Additional QR settings:**
- **Auto-accept orders** — toggle (default on). When off, every QR order requires manual staff acceptance.
- **Allow item notes** — toggle (default on).
- **Menu language** — defaults to "NL + EN (recommended)". Options: NL only, EN only, NL + EN.
- **Widget accent colour** — colour picker, default amber `#d4820a`. The "Order" button colour on the QR menu.

**Validation.** Plan selected. Other fields have defaults.

**Data written.** `restaurants.qr_plan` (`'basic'` / `'premium'`), `restaurants.qr_auto_accept`, `restaurants.qr_item_notes_allowed`, `restaurants.qr_menu_language`, `restaurants.qr_widget_accent_color`.

**Continue criteria.** Plan selected.

## Step 10 — QR codes (QR only)

**Purpose.** Confirm or set up the tables that will get QR codes; generate the codes.

**Inputs.**
- If the restaurant enabled Reservations and completed Step 2 (Floor plan), the existing tables are listed here for confirmation. The restaurant can add/remove for QR if their QR-enabled tables differ from booking-enabled tables.
- If Reservations is **not** enabled, this screen presents an empty floor-plan-like editor (zones + tables), reusing the same UI as Step 2.
- Below the table list: a "Generate QR codes" button. After clicking, the system creates one unique QR code per table.

**QR code generation.** Each table receives a unique `qr_token` (random 22-character URL-safe string). The QR encodes the URL `https://thetafel.nl/{restaurant_slug}/qr/{qr_token}`. The token is used instead of the table's database ID so QR codes can be regenerated (token rotated) if needed — for instance, after a Premium plastic card is lost.

After generation, each table shows a thumbnail preview of the QR image and a "Download" button. A "Download all" button bundles them into a ZIP.

**Server behaviour.**
- Generates one QR token per table.
- Renders the QR image server-side as PNG and stores it in Supabase Storage bucket `qr-codes`, path `{restaurant_id}/{table_id}.png`. RLS: read-only for the owner, no public access (the QR target URL is what guests see, not the PNG itself).

**Data written.** `restaurant_tables.qr_token`, `restaurant_tables.qr_image_path`.

**Continue criteria.** At least one QR code generated.

## Step 11 — Connect payments (Mollie) (all services)

**Purpose.** Set up the restaurant's Mollie account (sub-account under The Tafel's Mollie Connect platform), used for takeaway payment collection, QR pay-online, prepaid bookings, and the restaurant's own subscription billing.

**Inputs.** A single primary call-to-action: "Set up payments with Mollie." Clicking it opens Mollie's hosted onboarding flow in a new browser tab. The restaurant completes Mollie's flow (bank details, identity verification — Mollie already has KVK info from us via Connect API, so this is short) and is returned to The Tafel via a return URL.

**Below the CTA:** an explanation of what gets verified and what The Tafel never sees ("We never store your bank details — Mollie handles that securely").

**Server behaviour.**
- When the restaurant clicks the CTA: The Tafel creates an `organization` in Mollie Connect (or retrieves an existing one) using the KVK data already on file. The Mollie API returns an `organization_id` which is stored as `restaurants.mollie_organization_id`.
- Mollie then performs its own verification asynchronously.
- The Tafel listens for Mollie webhooks (`organization.updated`) to detect when verification completes.
- The webhook updates `restaurants.mollie_status` to one of: `pending`, `verified`, `rejected`, `needs_action`.

**Critical:** this step does **not** block onboarding completion. The restaurant clicks Continue regardless. The downstream consequence is captured in §4.14 — takeaway specifically is "paused" until Mollie clears.

**Data written.** `restaurants.mollie_organization_id`, `restaurants.mollie_status` (starts at `pending`), `restaurants.mollie_initiated_at`.

**Continue criteria.** Mollie hosted flow initiated (organization created in Mollie). Approval not required to continue.

## Step 12 — Subscription (all services)

**Purpose.** Choose a subscription tier, see all costs (including one-time QR fees), enter payment method for recurring billing.

**Inputs.**

**Three tier cards.** Pricing details to be finalised by the team — placeholders shown below.

| Tier | Price | Booking limit | Includes |
|---|---|---|---|
| **Starter** | €0/month | Limited bookings/month (TBD) | Reservations only, email reminders only, no WhatsApp |
| **Plus** | €49/month | Unlimited bookings | Reservations + Takeaway, email reminders, basic features |
| **Premium** | €99/month | Unlimited everything | All services, WhatsApp reminders, QR Premium plan available, priority support |

**One-time charges shown clearly below the tiers** (only if applicable):

- QR Basic setup: €119 (if QR plan = basic)
- QR Premium setup: €269 (if QR plan = premium)
- Extra tables beyond 20: €11 × (tables - 20)
- Total one-time: €X

**Free trial.** 84 days, no charge during trial period. Auto-charge begins on day 85. Payment method (via Mollie recurring mandate) is collected now but not charged for the subscription until trial ends. **One-time charges are charged immediately at submission of this step.**

**Inputs:**
- Tier selection (radio cards, exactly one)
- Payment method via Mollie hosted flow (sets up a recurring mandate)

**Validation.** Tier selected. Mollie recurring mandate created (or its setup has been initiated).

**Server behaviour.**
- Creates a `subscriptions` row with status `trialing`, trial end date 84 days out, billing day-of-month derived from go-live date.
- Initiates Mollie recurring mandate.
- Charges one-time fees via Mollie immediately (separate from the subscription).
- Schedules first subscription charge for day 85.

**Data written.** `subscriptions` row, `restaurants.subscription_tier`, `payments` table rows for any one-time charges.

**Continue criteria.** Tier selected, recurring mandate initiated.

## Step 13 — Contract & e-sign (all services)

**Purpose.** Present the platform terms and capture a legally binding e-signature.

**Inputs.**
- The contract is rendered inline in a scrollable container. Bilingual (NL + EN).
- The restaurant must scroll to the bottom (tracked client-side) before the signature box becomes active.
- A typed name field + a "draw your signature" canvas + a checkbox "I confirm I am authorised to sign on behalf of {restaurant}."
- Date and time of signing recorded automatically.
- A copy of the signed contract is generated as a PDF and stored.

**Contract contents.** Pricing tier confirmation, billing terms, trial terms (84 days), one-time fees breakdown, cancellation terms (30 days notice after trial), data processing (GDPR), liability, governing law (Netherlands).

**Server behaviour.**
- Stores the contract PDF in Supabase Storage `contracts` bucket (RLS: read-only for owner + The Tafel admin).
- Records the signature event (typed name, signature canvas as PNG, IP address, user agent, timestamp).
- The signed contract is emailed to the restaurant's `contact_email`.

**Data written.** `contracts` row with `signed_at`, `signed_name`, `signature_image_path`, `signed_ip`, `signed_user_agent`, `pdf_path`.

**Continue criteria.** Contract scrolled to bottom, signed name filled, signature drawn, authorisation checkbox ticked.

## Step 14 — Review & go live

**Purpose.** Final summary checklist; submit onboarding for the 60-minute team review.

**Inputs.** Read-only summary list with check marks: restaurant details, KVK, floor plan (if applicable), opening hours, no-show protection (if applicable), takeaway settings (if applicable), menu uploads (if applicable), QR codes (if applicable), Mollie status, subscription tier, contract signed.

A single primary button: **"Submit for review."**

**Server behaviour.**
- Sets `restaurants.status = 'pending_review'`.
- Sets `restaurants.submitted_at = now()`.
- Creates a `review_tasks` row visible to The Tafel admin staff.
- Notifies The Tafel admin via email + internal Slack / dashboard.
- The restaurant sees a confirmation screen: "Your setup has been submitted. Our team is reviewing — usually within 60 minutes. You'll get an email when you're live."

**The Tafel team review (out of restaurant flow).**
- Admin staff verifies everything looks correct in their admin panel (built later as part of Part 2 dashboard PRD).
- If correct: admin clicks "Approve & go live." This sets `restaurants.status = 'live'`, `restaurants.went_live_at = now()`.
- If issues: admin contacts the restaurant directly (out-of-band). No reject button in the system — courtesy-only review.

**After approval — the "You're live" screen.** The restaurant returns to The Tafel and now sees a celebratory screen:

> **Welcome to The Tafel, {restaurant name}.**
>
> Your reservation page is live at **thetafel.nl/{slug}**.
>
> Your takeaway and QR pages will go live once our design team has built your menu — usually within 2 business days. We'll email you when they're ready.
>
> **Open your restaurant web app →**

The "Open your restaurant web app" button takes them to the web-app login (the Part 2 dashboard, out of scope for this PRD).

---

## 4.14 Service-specific go-live timing

Not all services go live at the same time:

- **Reservations** — live within 60 minutes of submission (after team approval).
- **Takeaway** — live when **both** of these are true: menu has been built (~2 business days, manual by The Tafel design team) AND Mollie has verified the restaurant. If Mollie verifies in 4 hours and menu takes 2 days, takeaway goes live in 2 days. If Mollie takes 2 days and menu takes 1 day, takeaway goes live in 2 days.
- **QR ordering** — live when both: menu has been built AND QR codes have been physically delivered (Basic stickers or Premium cards). For Premium specifically, ~5–7 business days due to physical shipping.

The "You're live" screen and subsequent emails clearly state which services are active and which are still pending.

---

# 5. Sidebar and global navigation specification

The sidebar is the spine of the onboarding experience. It is always visible at desktop widths.

## 5.1 Structure

```
┌────────────────────────┐
│  THE                   │
│  TAFEL                 │
│  RESTAURANT SETUP      │
│                        │
│  [NL] [EN]             │
│                        │
│  [Booking] [Pickup]    │  ← service chips, only shown for selected services
│  [QR]                  │
│                        │
│  ✓ Business            │
│  ✓ Floor plan          │
│  ● Hours       (current)
│  ○ Rules               │
│  ○ No-shows            │
│  ...                   │
│                        │
│                        │
│  Need help? Our team   │
│  gets you live within  │
│  60 minutes — free.    │
│                        │
│  [Book a setup call]   │
└────────────────────────┘
```

## 5.2 Step states

- **Completed** — amber filled circle with checkmark, full-opacity label
- **Current** — amber outline circle with the step number inside, full-opacity label, optional thin amber bar to the left
- **Future, reachable** — muted circle outline, muted label, hover state shows slight brightening
- **Future, unreachable** — same as reachable but click does nothing (cannot skip ahead past required steps)

## 5.3 The progress bar

A 4-pixel-tall bar at the top of the right pane. Background `rgba(212,130,10,0.15)`, filled portion solid amber. Animated transition on step change. Width of the filled portion = (steps completed / total visible steps) × 100%.

---

# 6. Cross-cutting screen behaviours

## 6.1 Resume flow

A restaurant returning mid-onboarding hits any URL under `/onboarding/*`. The layout component:

1. Checks authentication; if not logged in, redirect to `/login` with the destination preserved.
2. Loads the `restaurants` row for `user_id = auth.uid()`.
3. If no row exists, sends them to Step 0.
4. If the row's `status = 'live'` or `'pending_review'`, sends them to a status page (not the wizard).
5. Otherwise, reads `current_onboarding_step` and redirects to that step's URL.

The sidebar shows all steps as muted-but-reachable for any step they've passed, allowing free movement back to earlier steps to edit values.

## 6.2 Autosave

Every editable field's `onBlur` handler calls the `PUT /api/v1/restaurants/draft` endpoint with `{ field, value }`. The endpoint validates against a server-side whitelist (the same pattern as in C.2 / C.3, extended to all new fields). On success, a brief "Saved" indicator appears below the field; on failure, the field shows an error and a retry is scheduled.

Some fields write to other tables (zones, tables, availability, menu_source_uploads, contracts). Those use dedicated endpoints documented per step.

## 6.3 The 60-minute review timer (after Step 14)

When a restaurant submits at Step 14, they see a confirmation screen with a soft countdown ("Estimated review time: about 60 minutes"). The system does not enforce 60 minutes — admin approval is manual. If approval takes longer than 90 minutes, the system emails the admin a reminder and the restaurant a "thanks for your patience" note.

---

# 7. Database architecture

This section gives a narrative overview; the canonical definitions live in `TheTafel_Onboarding_Schema_v1.0.sql`.

## 7.1 Database choice

PostgreSQL via Supabase. The project is `thetafel-prod` — the existing project we used during C.1–C.4 — with its previous schema dropped entirely and replaced with the schema in the companion file. The wiping migration is `001_drop_legacy_schema.sql` (in the companion file).

The Supabase organisation will be upgraded to the Pro plan at launch. Until then we remain on the free tier with the same two projects (`thetafel-website` and `thetafel-prod`).

## 7.2 Entity overview

The system is organised around these primary entities:

- **users** — Supabase Auth users (managed by Supabase, mirrored in `profiles`)
- **profiles** — one per user, holds preferences and language
- **restaurants** — the core entity, one per signed-up restaurant
- **zones** — many per restaurant
- **restaurant_tables** — many per zone
- **availability** — opening-hours rows, many per restaurant
- **menu_source_uploads** — files uploaded during onboarding for the design team
- **subscriptions** — one active per restaurant
- **payments** — many per restaurant (one-time fees, future subscription charges)
- **contracts** — one signed per restaurant
- **review_tasks** — internal admin queue
- **audit_logs** — system-wide append-only log of sensitive events

Tables that come later (in the dashboard / diner PRDs) but already need to be referenced architecturally: `bookings`, `orders`, `order_items`, `waitlist_entries`, `table_sessions`, `menu_categories`, `menu_items`, `menu_item_variants`, `qr_orders`, `staff_invites`, `staff_members`, `dietary_tags`. These are stub-defined in the schema file with comments noting they will be fully designed in their respective PRDs.

## 7.3 ID strategy

All primary keys are UUIDv4 (`gen_random_uuid()` default). No incrementing integer IDs in customer-facing data — prevents enumeration attacks.

Some entities have an additional `public_id` or token (e.g. `qr_token`, `restaurant.slug`) for URLs. These are URL-safe random strings.

## 7.4 Timestamps

Every table has `created_at` and `updated_at` columns (`timestamptz` default `now()`). A trigger keeps `updated_at` current. Soft-delete via a `deleted_at timestamptz` column is used on most entities; hard delete is reserved for GDPR right-to-erasure flows.

## 7.5 Row-level security (RLS)

Every table has RLS enabled. The policies fall into three patterns:

- **Owner access**: `restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid())`
- **Public read for active restaurants** (used for diner-facing reads): `restaurant_id IN (SELECT id FROM restaurants WHERE status = 'live')`
- **Service-role-only**: tables that should never be touched directly by users (audit_logs, review_tasks, internal admin tables) have no anon/auth policies and are only writable via service-role functions.

The full set of policies is in the schema file. The principle: **the database is the security boundary, not the application.** Any compromise of the application layer should not enable cross-restaurant data access.

## 7.6 Indexes

Indexes are defined for every query pattern the onboarding uses. The critical ones:

- `restaurants(user_id)` — every page load queries by this
- `restaurants(kvk_number)` UNIQUE
- `restaurants(slug)` UNIQUE
- `restaurant_tables(restaurant_id)`
- `restaurant_tables(qr_token)` UNIQUE
- `availability(restaurant_id, day_of_week)`
- `menu_source_uploads(restaurant_id)`
- `subscriptions(restaurant_id)` with a partial WHERE status = 'active'
- `audit_logs(restaurant_id, created_at DESC)`

Booking-engine indexes (for the dashboard / diner PRDs) are pre-allocated in the schema file as comments so they are not forgotten:
- `bookings(restaurant_id, booking_date, booking_time)` — the core slot lookup
- `table_sessions(restaurant_table_id) WHERE closed_at IS NULL` — open session lookup

## 7.7 Concurrency and locking

Critical operations use Postgres advisory locks or row-level locks. Specifically:

- KVK uniqueness — enforced by the UNIQUE constraint at insert time; on conflict, the second restaurant gets a clear "this KVK is already linked" error.
- Subscription mutation — `FOR UPDATE` lock on the `subscriptions` row when changing tier.
- Booking creation (future, in dashboard PRD) — uses `SELECT ... FOR UPDATE` on a "slot" semantic, or relies on a precomputed `slot_capacity` table with a count + insert pattern under serializable isolation. The exact mechanism will be specified in the booking-engine PRD but the schema is designed to make it possible.

---

# 8. Security architecture

This is the section that addresses the "perfect security so the system doesn't crash on a busy Saturday and can't be hacked by a third party" requirement. The standard targeted here is what reputable Dutch SaaS companies operate at: practical, defensible, GDPR-compliant security. Bank-grade certification (SOC 2) is out of scope for this stage.

## 8.1 Authentication

- Supabase Auth handles signup, login, password reset, email verification, and session tokens.
- Passwords: minimum 12 characters, must include letters and numbers; checked against the common-password list (top 100k breached passwords) at signup.
- Sessions: JWT-based, 28800 seconds (8 hours) expiry, refresh-token rotation enabled.
- Email verification required before any onboarding step beyond Step 0 — enforced by middleware (the `proxy.ts` file from C.1, preserved).
- Magic link flow uses `token_hash` + `verifyOtp` (the SSR pattern we settled on in Phase B; the `action_link` approach is forbidden).

## 8.2 Authorization

Three principal roles:

- **Owner** (the original signed-up user for a restaurant) — full access to that restaurant's data via RLS.
- **Staff** (invited later from the dashboard, not during onboarding) — restricted access, defined in the Part 2 dashboard PRD. The schema includes a `staff_members` table with a `role` column so the policies are forward-compatible.
- **Admin** (The Tafel internal team) — accessed via a separate admin tenant with a service-role authentication. Admins can read all restaurants but their actions are logged to `audit_logs`. Admin UI is built in a later PRD.

The principle: **Owner cannot see another restaurant's data. Staff cannot see settings or payments. Admin actions are always logged.**

## 8.3 Server-side-only operations

These operations **never** happen client-side:

- KVK API calls
- PDOK address lookups
- Mollie API calls (all of them — subscription creation, charges, webhook handling)
- File upload validation (size, type, content sniffing)
- Service-role database access
- WhatsApp Business API calls
- Email sends via Resend
- Contract PDF generation and signing
- AI menu builder (when later added) — Claude API calls

The `NEXT_PUBLIC_*` environment variables include only safely-public values (the Supabase anon key, the Plausible domain). The service-role key, Mollie API key, KVK API key, WhatsApp token, Resend key, and Claude API key are all unprefixed and server-only.

## 8.4 Rate limiting

Every public-facing API endpoint has an Upstash Redis-backed rate limiter:

| Endpoint | Limit | Reason |
|---|---|---|
| `/api/auth/*` | 5 per IP per minute | Brute force prevention |
| `/api/kvk/search` | 30 per IP per minute | KVK API budget |
| `/api/kvk/profile` | 30 per IP per hour | KVK Basisprofiel is paid |
| `/api/pdok/lookup` | 30 per IP per minute | PDOK is free but courtesy |
| `/api/v1/restaurants/*` | 60 per user per minute | Soft cap on draft saves |
| `/api/mollie/webhook` | unlimited but signature-verified | Webhook endpoint |
| File uploads | 10 per user per hour | DOS prevention |

Limits are tightened in production after monitoring. Dev environment bypasses all rate limits.

## 8.5 Input validation and sanitisation

All user input is validated server-side against an explicit schema. Three layers:

1. **Type validation** — Zod or hand-rolled validators on every endpoint.
2. **Format validation** — KVK = 8 digits, postcode = `1234AB`, email RFC-compliant, phone E.164 or Dutch national.
3. **Content validation** — text fields stripped of control characters, length-capped, no script-like content.

File uploads have an additional **MIME sniffing** step (not relying solely on the content-type header): the first bytes of the uploaded file are read and matched against the expected magic number for the declared type. A PNG-claimed file that doesn't start with `89 50 4E 47` is rejected.

## 8.6 Payment data

The Tafel never touches raw card data. All payment UIs are Mollie's hosted pages. The schema stores only:

- Mollie organisation IDs and mandate IDs (opaque references)
- Charge IDs and statuses
- Last four digits of the card (returned by Mollie for display only)

Bank account numbers are never stored. The IBAN is held only inside Mollie.

## 8.7 Storage security

Supabase Storage buckets:

| Bucket | Public? | Contents | Access |
|---|---|---|---|
| `restaurant-assets` | Public read | Hero images, designed menu photos (later) | Owner write, public read |
| `restaurant-menu-sources` | Private | Menu PDFs uploaded during onboarding | Owner write, The Tafel admin read |
| `qr-codes` | Private | Generated QR PNG images | Owner read-only |
| `contracts` | Private | Signed contract PDFs | Owner read-only, admin read |

Storage RLS policies are defined explicitly per bucket. The C.4 fix (storage policies that allow authenticated upload to `restaurant-assets`) is preserved and extended for the new buckets.

## 8.8 CSRF and same-origin

Next.js App Router with server actions provides built-in CSRF protection. All write endpoints check the `Origin` header against an allowlist (`thetafel.nl`, `thetafel-website.vercel.app`, `localhost:3000`).

## 8.9 Content Security Policy

A strict CSP header is set in `next.config.js`:

- `default-src 'self'`
- `script-src 'self' 'unsafe-inline'` (inline limited to Next.js inlined scripts) `https://plausible.io`
- `connect-src 'self'` plus `api.mollie.com`, Supabase domain, Resend domain
- `frame-src 'self'` plus Mollie hosted pages
- `img-src` allows Supabase storage CDN and `data:` for SVG inlines
- `style-src 'self' 'unsafe-inline'` (for next/font)

CSP is reported via a CSP-report endpoint, not blocked in production until monitoring is in place.

## 8.10 Encryption

- All traffic over HTTPS (Vercel default, Let's Encrypt cert).
- Database at rest is encrypted by Supabase (AES-256).
- Specific sensitive fields (Mollie organisation IDs, Mollie mandate IDs, signed contract IPs) are stored encrypted using the `pgcrypto` extension with a server-side key in an environment variable. The key is rotated annually.
- The Resend, Mollie, KVK, WhatsApp, and Claude API keys live only as Vercel environment variables, never in code.

## 8.11 Audit logging

Sensitive actions are appended to `audit_logs`:

- Every authentication event (success, failure)
- Every payment-related action (charge initiated, charge succeeded, refund)
- Every Mollie webhook received
- Every admin action (admin viewed restaurant, admin approved go-live)
- Every settings change (in onboarding and dashboard)
- Every staff invite and login

Audit logs are append-only, never updated or deleted programmatically. They are retained for 7 years to satisfy Dutch tax / commercial law.

## 8.12 Backups and disaster recovery

- Supabase provides daily backups on the Pro plan (which we upgrade to at launch). Backups retained for 7 days on Pro; 30 days on the next tier up — to be evaluated.
- Storage buckets are backed up via Supabase's storage replication.
- A weekly export of critical tables (`restaurants`, `subscriptions`, `payments`, `contracts`) to an off-Supabase cold-storage location (e.g. an encrypted S3 bucket) is scheduled. Retained for 1 year.
- Restore-from-backup procedure documented separately in the runbook.

## 8.13 What gets monitored

- Vercel runtime logs for all serverless functions (using the existing `get_runtime_logs` MCP path during dev).
- Sentry for client-side exceptions and server-side errors (already in the stack).
- Plausible for non-intrusive analytics (no cookies, no GDPR concerns).
- A health-check endpoint `/api/health` checks Supabase, Mollie API ping, Resend API ping. Pinged externally by UptimeRobot or Better Uptime.

## 8.14 What does **not** ship in onboarding security

To be honest about what is **not** built at launch:

- No SOC 2 audit.
- No formal penetration test (recommended within 6 months of launch).
- No DDoS protection beyond what Vercel/Cloudflare provides at the edge.
- No hardware security modules.
- No anomaly detection / fraud scoring beyond Mollie's own.

These can be added as the business grows. The current setup is what reputable Dutch SaaS companies operate at.

---

# 9. Payment architecture

## 9.1 Mollie Connect for Platforms

The Tafel uses **Mollie Connect for Platforms**, which is Mollie's product for marketplaces and platforms that take payments on behalf of sub-merchants. The model:

1. **The Tafel** is the **platform** in Mollie's terms. The Tafel has one Mollie account with Connect enabled.
2. Each **restaurant** is an **organization** (sub-merchant) under the Tafel platform. They have their own Mollie sub-account.
3. When a diner pays for takeaway (€20):
   - The diner's payment goes to Mollie.
   - Mollie splits: The Tafel's 5.1% commission (€1.02) goes to The Tafel's account; the remainder (€18.98) goes to the restaurant's Mollie sub-account.
   - Mollie pays out the restaurant's balance to their bank weekly (Mollie default).

This is the standard pattern for SaaS marketplaces in Europe.

## 9.2 Restaurant onboarding into Mollie

During Step 11, The Tafel calls the Mollie Connect API to create an organisation for the restaurant. The KVK number, legal name, legal address, and contact details are passed to Mollie. Mollie does its own KYC (Know Your Customer) verification, which is mandatory under EU anti-money-laundering law (AMLD5 / AMLD6).

Verification timeline:
- **Best case**: minutes to a few hours (Mollie auto-verifies via KVK).
- **Typical**: a few hours.
- **Worst case**: 1-2 business days if Mollie requests additional documents.

This is why onboarding does not block on Mollie completion. The restaurant clicks Continue and moves forward; Mollie verification happens in parallel.

## 9.3 Webhook handling

The Tafel exposes `/api/mollie/webhook` to receive Mollie events:

- `organization.updated` — restaurant verification status changed
- `payment.paid` — a charge succeeded (one-time fees, takeaway orders, prepaid bookings)
- `payment.failed` — a charge failed
- `subscription.charged` — recurring subscription payment processed
- `subscription.cancelled` — subscription ended
- `mandate.revoked` — restaurant's recurring mandate was revoked

Webhook security:
- Mollie signs every webhook with a secret. The Tafel verifies the signature on every webhook receipt. Unsigned or wrongly-signed webhooks are 403'd and logged.
- Webhooks are idempotent on the Mollie payment ID — repeated delivery of the same event is a no-op.
- Webhook handler writes to `audit_logs` for every event.

## 9.4 One-time fees

The QR setup fee (€119 or €269) and any extra-table fees (€11 each, beyond 20) are charged via a Mollie one-time payment at the moment the restaurant submits Step 12 (subscription selection). The flow:

1. Step 12 submission triggers a `POST /api/v1/payments/onetime` server route.
2. The route calculates the total, creates a Mollie payment, redirects the restaurant to Mollie's hosted payment page.
3. After the restaurant pays, Mollie redirects them back to The Tafel and sends a `payment.paid` webhook.
4. The Tafel writes a `payments` row and advances onboarding.
5. If the payment fails, the restaurant is shown a retry screen.

## 9.5 Subscription billing

After the 84-day free trial:

- Day 85: Mollie initiates the first recurring charge via the mandate established at onboarding.
- Subsequent charges every 30 days.
- On a failed charge, Mollie retries automatically (3 attempts over 7 days).
- After final failed retry, The Tafel marks the subscription `past_due` and emails the restaurant. After 14 days `past_due`, the subscription is `suspended` — restaurant can still log in but customer-facing services are paused.
- The restaurant can cancel any time from the dashboard (or contact The Tafel before the trial ends).

## 9.6 Commission flows

| Transaction | Commission | Mechanism |
|---|---|---|
| Takeaway order | 5.1% | Mollie split at payment time |
| QR order (pay online) | 0% | Full amount to restaurant |
| QR order (pay at table) | 0% | Not processed through Mollie at all |
| Prepaid booking deposit | 0% | Full amount held in escrow by Mollie, refunded to guest on attendance |
| Restaurant subscription | 100% to The Tafel | Direct Mollie charge |
| QR setup fee | 100% to The Tafel | One-time Mollie charge |

## 9.7 Refunds

- Takeaway customer cancellations before restaurant acceptance: full refund, automatic via `/api/v1/orders/{id}/cancel`.
- Cancellations after acceptance: no automatic refund; restaurant can issue manually from the dashboard.
- QR order paid-online refunds: same pattern.
- Prepaid booking refunds: automatic on guest cancellation up to 2 hours before; staff-initiated otherwise.

Refunds go through Mollie's refund API; The Tafel's commission (where applicable) is also returned proportionally.

---

# 10. Third-party integrations

## 10.1 KVK (Dutch Chamber of Commerce)

**Purpose:** Business identity verification at Step 1.
**APIs used:** Zoeken API (search, free), Basisprofiel API (full profile, €0.02 per call).
**Auth:** API key in `KVK_API_KEY` env var. Test environment in dev (`KVK_API_BASE_URL=https://api.kvk.nl/test/api`), production environment at launch.
**Caching:** Search results cached in Upstash for 5 minutes; Basisprofiel results cached for 24 hours.
**Failure mode:** If KVK is down, Step 1 shows an error and a "try again later" message. The restaurant can come back; no other step is affected.

## 10.2 PDOK (Locatieserver)

**Purpose:** Address autocomplete from postcode + house number.
**Used in:** Step 1 (address verification), potentially also Step 2 if the restaurant edits address fields.
**Auth:** None (free public API).
**Caching:** 24 hours per postcode+huisnummer combination.
**Failure mode:** Manual address entry fallback always available.

## 10.3 Mollie

Covered in §9.

## 10.4 Resend

**Purpose:** Transactional email (welcome, magic link, booking confirmations, takeaway updates, contract delivery, etc.).
**Auth:** API key in `RESEND_API_KEY`.
**Sender:** `hallo@thetafel.nl`.
**Templates:** Branded HTML templates in cream/amber theme, stored in `/emails` folder, rendered via React Email or simple template strings.
**Also configured as:** Supabase custom SMTP, so authentication emails (verification, password reset) go through Resend too.
**Failure mode:** Emails are queued and retried on failure. If Resend is down for an extended period, an admin alert fires.

## 10.5 WhatsApp Business Cloud API

**Purpose:** Reminders (premium tier), booking confirmations, takeaway pickup notifications.
**Auth:** Bearer token in `WHATSAPP_TOKEN`, phone number ID in `WHATSAPP_PHONE_ID`.
**Templates:** Pre-approved WhatsApp message templates (Meta's required approval flow).
**Cost:** Per-message charges absorbed into Premium subscription up to a monthly cap; overage at €0.05/message billed monthly.
**Failure mode:** If WhatsApp send fails, fall back to email. Log the failure.

## 10.6 Upstash Redis

**Purpose:** Rate limiting and caching.
**Auth:** REST URL and token in `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
**Used for:** API rate limits, KVK/PDOK response caches, future session cache.
**Failure mode:** If Upstash is unreachable, rate limits are skipped (fail-open) and caching falls through to direct API calls. Critical for not blocking onboarding on a cache outage.

## 10.7 Claude API (future)

**Purpose:** AI menu builder (parsing uploaded menu PDFs into structured items). **Not in this PRD's scope** — the menu upload step deliberately omits AI extraction at launch (The Tafel design team builds the menu manually). The Claude API may be added later for assistant features in the dashboard.

## 10.8 Plausible Analytics

**Purpose:** Privacy-respecting analytics.
**Auth:** None (cookieless).
**Failure mode:** Silent — analytics is decorative.

## 10.9 Vercel

**Purpose:** Hosting.
**Plan:** Hobby (free) during onboarding development; will upgrade to Pro before launch for production traffic, custom domains, and team features.

## 10.10 Sentry

**Purpose:** Error monitoring.
**Failure mode:** Silent.

---

# 11. Operational concerns

## 11.1 Concurrency — why the system doesn't crash on a busy Saturday

The fear behind this requirement is real: a popular restaurant's booking page being hammered by guests at 19:00 on a Saturday should not crash The Tafel. The architecture protects against this in several ways.

**Stateless serverless functions.** Every API route in Next.js App Router runs as a Vercel serverless function. Vercel scales these horizontally — there's no fixed pool of servers to exhaust. A burst of 10,000 simultaneous booking attempts spawns up to thousands of concurrent function instances.

**Database connection pooling.** Each serverless function instance does not open a fresh PostgreSQL connection. Supabase provides a connection pooler (PgBouncer) at port 6543 that multiplexes thousands of function calls into a small pool of actual database connections. We use this exclusively in production. The `DATABASE_URL` env var points at the pooled port.

**The booking insertion race condition.** Two guests trying to grab the last seat at 19:00:

- Each guest's booking attempt opens a transaction.
- The transaction acquires a `FOR UPDATE` row lock on a "slot semantics" row — either a specific availability row or an explicit "slot reservation" advisory lock keyed by `(restaurant_id, date, time, zone)`.
- Inside the lock: count existing bookings + their party sizes for this slot, compare against capacity, decide.
- Only one transaction can hold the lock at a time. The other waits, then sees the slot is full, and is told "just filled up."

The exact implementation detail is in the booking-engine PRD, but the schema is designed to make it work: indices are in place, the `bookings` table has the right constraints, and the slot-semantics is decidable from data on hand without expensive joins.

Same mechanism for takeaway capacity (if any), QR ordering of limited-stock items, and prepaid-booking deposit handling.

**Slow queries are caught.** Every query in the onboarding flow has been indexed. The schema file lists all indices. There are no full table scans on any user-facing query path.

**Third-party outages are isolated.** Mollie down? Onboarding continues, takeaway is delayed. KVK down? Step 1 shows an error, other restaurants in other steps continue. WhatsApp down? Reminders fall through to email. The system is built so a single dependency's outage doesn't take down the whole site.

## 11.2 Performance budgets

| Operation | Target P95 | Maximum acceptable |
|---|---|---|
| Page load (cold) | < 1.5s | < 3s |
| Page load (warm) | < 500ms | < 1s |
| `PUT /api/v1/restaurants/draft` | < 200ms | < 500ms |
| KVK search | < 1s | < 3s |
| Mollie webhook handling | < 500ms | < 2s |
| File upload (10 MB) | < 5s | < 15s |

Measured in production via Vercel analytics. Performance regressions flag in PR review.

## 11.3 Capacity planning

At launch we expect tens of restaurants, low hundreds within months, low thousands within a year. The architecture scales well beyond this — Supabase Pro supports thousands of concurrent connections, Vercel scales to whatever traffic Vercel sees globally. The bottlenecks to watch:

- Supabase database CPU on the Pro plan — upgrade to higher tiers if sustained > 60% utilisation.
- Storage costs as menus accumulate — set lifecycle rules to archive old menu-source-uploads after 6 months (the designed menu is stored elsewhere; the source can be cold).
- KVK API spend if onboarding traffic grows — Basisprofiel costs add up. Caching is already aggressive; expand to longer TTLs if needed.

## 11.4 Deployment and environments

- **Local dev:** `npm run dev`, points at the same `thetafel-prod` Supabase project (this is workable while the schema is small and test data is fine; once we have real customers the dev env should be split into a separate Supabase project — flagged for the post-launch period).
- **Vercel preview deployments:** every PR gets a preview URL. Connected to the same Supabase project but with a separate prefix on cache keys.
- **Production:** `thetafel.nl`.

All three environments share the same env var contracts; differences are in the values.

## 11.5 Operational runbook (high-level — full runbook is a separate document)

- Where to find logs: Vercel dashboard → Runtime Logs.
- Where to find errors: Sentry.
- Where to find audit logs: Supabase SQL editor, table `audit_logs`.
- Who to escalate to: documented in the runbook.
- How to roll back a deployment: Vercel one-click rollback to a previous deployment.
- How to disable a feature: every major feature has a kill-switch env var (e.g. `FEATURE_TAKEAWAY_ENABLED=false`) checked at runtime — flagged in the schema file.

---

# 12. GDPR and legal

## 12.1 Data controller / processor

The Tafel B.V. is the **data controller** for restaurant data (the restaurant owner's identity, contact, business details).

The Tafel B.V. is a **data processor** for diner data on behalf of each restaurant (the diner's name, contact, booking, order). Each restaurant is the controller of its diners' data.

This distinction is reflected in the contract signed at Step 13 — a Data Processing Agreement (DPA) is part of the contract.

## 12.2 Lawful basis

- Restaurant signup: contract (Article 6(1)(b) GDPR).
- Diner bookings/orders (processed on behalf of restaurant): contract.
- Marketing emails to restaurants: legitimate interest with opt-out.
- WhatsApp messages: contract (transactional only); marketing WhatsApp requires explicit opt-in (not in scope at launch).
- Analytics (Plausible): no consent needed (cookieless, anonymised).

## 12.3 Data retention

- Active restaurant data: retained for the life of the subscription + 7 years (tax law).
- Cancelled restaurant data: 7 years from cancellation.
- Diner booking/order history: retained per restaurant's choice (default: 2 years).
- Audit logs: 7 years (legal).
- Menu source uploads: 1 year from menu go-live (after which the designed menu in the system is the source of truth; the raw upload is no longer needed and gets archived to cold storage).
- Signed contracts: 7 years.

## 12.4 Right to erasure (GDPR Article 17)

A restaurant can request deletion via support. The Tafel:
1. Verifies the request authenticity.
2. Anonymises identifiable data in `restaurants`, `users` (replacing PII with hashed values; the row is kept for foreign-key integrity but is no longer linkable to a person).
3. Deletes uploaded files.
4. Retains audit log entries (legal requirement) but marks the user as deleted.

Diner-level erasure requests are forwarded to the restaurant that holds the booking record (each restaurant is its own controller).

## 12.5 Data portability

Restaurants can export their data via a "Download my data" button in the dashboard (built in Part 2). Output is a ZIP containing JSON files of all tables that pertain to them.

## 12.6 Cookies

The Tafel uses minimal first-party cookies for session authentication (Supabase) and language preference. No tracking cookies. No third-party cookies. No cookie banner is needed under the strictest read of the ePrivacy Directive, but a small "This site uses cookies for login only" footnote appears on first visit, dismissible.

## 12.7 Data residency

All data is stored in the EU. Supabase project is in the `eu-west-2` (London) region. Vercel deployments are in EU regions. Mollie is EU-based. Resend has EU data residency option enabled.

---

# 13. What survives from C.1–C.4

This is the rebuild reckoning. The work from C.1 through C.4 is not lost — much of it carries over. This section lists exactly what survives, what changes, and what is discarded.

## 13.1 Survives unchanged

- The Supabase project `thetafel-prod` itself. Schema is wiped and replaced (Path 2). The project ID, env vars, RLS infrastructure all stay.
- The codebase at `D:\The Tafel pivot\thetafel-website`. Same repo, restructured.
- The auth system (Phase B) — magic links, password setup, login, forgot-password. Including the SSR `createSupabaseServerClient` helpers, the `proxy.ts` middleware (Next.js 16 convention), the email templates, the locale-preservation through email round-trips.
- The KVK lookup routes (`/api/kvk/search`, `/api/kvk/profile`). The smart digit routing, the cache, the rate limits, the field mappings.
- The PDOK lookup route (`/api/pdok/lookup`).
- The draft autosave pattern (`/api/v1/restaurants/draft`). The field whitelist will be massively expanded but the architecture is identical.
- The photo upload route (`/api/v1/restaurants/photo`) — used for menu photos uploaded by The Tafel design team.
- The storage bucket structure and RLS policies, extended with new buckets (`restaurant-menu-sources`, `qr-codes`, `contracts`).
- Brand tokens, fonts, colours, the layout primitives (`StepLayout`, though it gets restructured for the sidebar layout).
- All env var infrastructure (Resend, Upstash, Mollie credentials, KVK credentials).
- The marketing site at `thetafel.nl` (untouched — it remains in `thetafel-website` Supabase project).

## 13.2 Changes (rebuilt, but pattern preserved)

- The top-bar progress UI is replaced with the left-sidebar layout. `StepLayout` and `ProgressBar` components are rewritten but the per-step page contract (eyebrow, heading, sub, content, footer with Back/Continue) is preserved.
- The `restaurants` table gets many new columns; some existing columns are repurposed. The whole schema is reset, so this is technically a fresh design — but the pattern of "one row per restaurant, user_id FK" is identical.
- The Step 1 (KVK) page is restyled to the new richer design with the dark verification card and SBI check.

## 13.3 Discarded

- The 6-step progress-bar wizard from C.1–C.4. Replaced by the 14-step sidebar wizard.
- The old `restaurants` schema (the 7 tables from migration 010 onwards). All dropped, replaced.
- The Step 2/3 floor-plan-as-dining-venue-address conflation. Floor plan is now its own thing; dining venue address comes from KVK address with a separate edit option.
- The C.5 opening-hours prompt that was prepared but never run. The new Step 3 supersedes it.
- The Step 3 cuisine-photo-vibe page (C.4). Cuisine moves to Step 1; photos move to The Tafel design team (post-onboarding); vibe (description) moves to the menu-upload step's cuisine description field.

## 13.4 Test data

All test data in `thetafel-prod` is wiped as part of the schema reset. No real restaurants are affected (we never went to production with C.1–C.4).

## 13.5 Migration scripts

The first migration in the new schema (`001_drop_legacy_schema.sql`) drops every existing public-schema table from the C.1–C.4 era. The second migration (`002_create_initial_schema.sql`) sets up the new tables. From there, schema changes follow the existing per-migration pattern.

---

# 14. Glossary

| Term | Meaning |
|---|---|
| Booking window | How far in advance a guest can book (e.g. 90 days). |
| KVK | Kamer van Koophandel — the Dutch Chamber of Commerce. Issues the KVK number every Dutch business has. |
| Lead time | Minimum time between booking creation and the booking's actual time (e.g. "must book at least 1 hour ahead"). |
| Mollie Connect | Mollie's product for marketplaces; lets one platform take payments on behalf of many sub-merchants and split funds. |
| No-show | A guest who booked but didn't arrive. |
| Occupancy duration | Average time a booking holds a table (e.g. 90 min). |
| PDOK | The Dutch government's address lookup service (Locatieserver). Free. |
| Per-slot cap | A restaurant-defined ceiling on total guests booked in a single time slot, separate from raw table capacity. |
| RLS | Row-Level Security — PostgreSQL feature that enforces per-row access policies at the database level. |
| SBI code | Dutch business activity classification. 56.x codes are for restaurants and food service. |
| Slot interval | Granularity of booking time slots (e.g. 30-minute slots: 19:00, 19:30, 20:00). |
| Slot semantics | The way the database identifies "the same slot" for capacity checking — typically `(restaurant_id, date, time)`. |
| Table session | A QR ordering construct: multiple orders from the same table in one sitting, grouped together until staff close the session. |
| Turnover buffer | Empty time between two bookings on the same table for cleaning (e.g. 15 min). |
| Waitlist | Mechanism for guests to be notified if a fully-booked slot opens up. |
| WhatsApp Business | Meta's official business messaging API (Cloud API variant). |

---

# 15. What this PRD does not cover

To set clear expectations:

- **The restaurant dashboard / web app** (Part 2 PRD): every screen the restaurant sees after onboarding — live order feed, booking calendar, settings, reports, staff management, menu editing, payment views.
- **The diner-facing pages** (Part 3 PRD): the booking widget, the takeaway ordering page, the QR menu, all confirmation pages, all email templates the diner sees.
- **The booking engine itself** (Part 2): the exact transactional flow for inserting a booking, the slot-semantics decision, the waitlist promotion logic. This PRD specifies that the onboarding collects enough data for the engine to do its job, but the engine itself is the dashboard PRD's concern.
- **The admin tooling** (separate, internal): the screens used by The Tafel staff to review onboarding submissions, build menus, manage payouts.
- **Build plans**: this is a PRD, not a build plan. The build plan for this onboarding flow is a separate document, written next, with the same one-step-at-a-time discipline we have used through C.1–C.4.

---

# End of PRD Part 1

This document, alongside `TheTafel_Onboarding_Schema_v1.0.sql`, is the complete specification for the restaurant owner onboarding flow of The Tafel.

It is to be reviewed by the team, marked up where anything is wrong or missing, and finalised before the build plan is written. After review, this PRD enters project knowledge, replacing all earlier onboarding PRDs.

Next document: **TheTafel_Onboarding_BuildPlan_v1.0** — the step-by-step build plan derived from this PRD.

Subsequent PRDs: **Part 2 (Dashboard)** and **Part 3 (Diner-facing)**.


# The Tafel — Onboarding Build Plan
## Companion to TheTafel_Onboarding_PRD_v1.0.md

**Document:** TheTafel_Onboarding_BuildPlan_v1.0
**Scope:** Step-by-step plan to construct the restaurant owner onboarding flow specified in the PRD.
**Status:** Source of truth for build execution. Replaces all earlier build plans.

---

## 0. How to use this document

This is **not** the PRD. The PRD says *what* to build; this document says *how to build it, in what order, and in what size of step.*

The plan follows the same one-sub-step-at-a-time rhythm we have used through C.1–C.4:

1. Read the sub-step in this document.
2. Claude writes a prompt file (or files) and presents it.
3. You paste the prompt into Claude Code, save the file(s), run `npm run build`.
4. You report the build result and any test results back.
5. We move to the next sub-step.

No sub-step is skipped. No sub-step combines two pieces of work that should be separate. If a sub-step gets too big mid-way through, we split it.

**Phase numbering.** The previous build (the marketing site, auth, the old onboarding) used phases A, B, C. Those phases are complete and archived. This document uses phases **D0 through D9** for the new onboarding rebuild. The dashboard build (Part 2) will be E-prefixed; the diner-facing build (Part 3) will be F-prefixed.

**Step terminology.** A *step* is a unit of work covering a single screen, route, or feature. A *sub-step* is the smallest atomic commit — typically one file or one focused change. Phases group steps; steps group sub-steps.

---

## 1. Phase overview

| Phase | Title | Purpose | Approx. steps |
|---|---|---|---|
| **D0** | Reset and foundation | Wipe legacy schema, apply new schema, regenerate types, restructure repo | 6 |
| **D1** | Onboarding shell | New layout primitives: sidebar, progress bar, step frame, language toggle, autosave hook | 5 |
| **D2** | Service picker (Step 0) | The "Choose your services" pre-step | 2 |
| **D3** | Reservation steps (1, 2, 3, 4, 5, 6) | Business / Floor plan / Hours / Rules / No-shows / Guest experience | 6 |
| **D4** | Takeaway steps (7, 8 — menu shared with QR) | Online ordering + menu upload | 3 |
| **D5** | QR steps (9, 10) | QR setup + QR codes | 3 |
| **D6** | Payment connection (Step 11) | Mollie hosted onboarding | 3 |
| **D7** | Subscription + contract (Steps 12, 13) | Tier selection, one-time fees, e-sign | 4 |
| **D8** | Submit + review + go-live (Step 14) | Submission flow, admin approval surface, "you're live" screen | 3 |
| **D9** | Hardening, ops, polish | Rate limit verification, audit logging, GDPR checklist, perf budgets, security pass | 5 |

Total: ~40 steps, each broken into 2–8 sub-steps. Realistic pace: 1–3 sub-steps per working session.

---

## 2. Phase D0 — Reset and foundation

This phase prepares the codebase and database. No user-visible work yet.

### D0.1 — Snapshot and archive

**Purpose.** Before we wipe anything, take a snapshot of the current working state so we can refer back to C.1–C.4 work if needed.

**Sub-steps:**

- **D0.1.1 — Tag the current commit.** Create a git tag `archive/c4-final` at the current HEAD of `main`. Push the tag. This is the recoverable snapshot of the C.1–C.4 onboarding.
- **D0.1.2 — Document what's archived.** Create `docs/ARCHIVE_C1_C4.md` summarising what was built in C.1–C.4, where the prompts live (the existing `prompts/` folder), and what the schema looked like at that point. One file, ~1 page.

**Verification.** `git tag -l | grep archive` shows the tag. `docs/ARCHIVE_C1_C4.md` exists.

**Gate to next sub-step:** snapshot done.

### D0.2 — Wipe the legacy schema

**Purpose.** Apply the Path 2 legacy-drop migration so `thetafel-prod` starts from a clean state.

**Sub-steps:**

- **D0.2.1 — Inspect current schema.** Use the Supabase MCP to list current tables in `thetafel-prod`. Confirm the list matches what the schema file's section 02 expects to drop. Paste the list back; Claude verifies.
- **D0.2.2 — Apply the legacy drop.** Run the `02 - legacy schema drop` block from `TheTafel_Onboarding_Schema_v1.0.sql` against `thetafel-prod` via the Supabase MCP `apply_migration` tool, migration name `001_drop_legacy_schema`. Verify all listed tables are gone.
- **D0.2.3 — Verify clean state.** Run `SELECT tablename FROM pg_tables WHERE schemaname = 'public';` — should return only Supabase-managed tables (none of the legacy app tables).

**Verification.** Confirmed empty `public` schema (apart from Supabase's own).

**Gate to next sub-step:** schema wiped, confirmed.

### D0.3 — Apply the new schema

**Sub-steps:**

- **D0.3.1 — Apply extensions and helpers (section 01).** Migration name `002_extensions`.
- **D0.3.2 — Apply core entities (section 03).** Migration name `003_core_entities`. Tables: profiles, restaurants, zones, restaurant_tables, availability. Verify each table exists.
- **D0.3.3 — Apply operational onboarding tables (section 04).** Migration name `004_operational_tables`. Tables: menu_source_uploads, contracts, review_tasks.
- **D0.3.4 — Apply payment tables (section 05).** Migration name `005_payments`. Tables: subscriptions, payments, mollie_webhook_events.
- **D0.3.5 — Apply audit table (section 06).** Migration name `006_audit_logs`.
- **D0.3.6 — Apply forward-compatible stubs (section 07).** Migration name `007_forward_stubs`. Tables: staff_members, menu_categories, menu_items, menu_item_variants, bookings, waitlist_entries, orders, order_items, table_sessions.
- **D0.3.7 — Apply RLS policies (section 08).** Migration name `008_rls_policies`. Verify with `SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public' ORDER BY tablename, policyname;` — count must match expected total from the schema file.
- **D0.3.8 — Apply storage bucket setup (section 09).** Migration name `009_storage_buckets`. The pre-existing `restaurant-assets` bucket is preserved. New buckets: `restaurant-menu-sources`, `qr-codes`, `contracts`. Verify with `SELECT id, public FROM storage.buckets;`.

**Verification after each:** the migration applies without error. After D0.3.8, the full table list matches the schema file exactly.

**Gate to next sub-step:** all migrations applied, verified.

### D0.4 — Regenerate TypeScript types

**Sub-steps:**

- **D0.4.1 — Run `supabase gen types typescript`** for the `thetafel-prod` project, write output to `packages/db/types.ts`. Confirm the file compiles and the type for `Database['public']['Tables']['restaurants']` looks correct (has all the new columns from the schema).

**Verification.** `npm run build` passes; old type imports updated where needed.

**Gate to next sub-step:** types regenerated, build clean.

### D0.5 — Restructure the repo

**Purpose.** Lay out the directory structure for the new onboarding before any pages are written.

**Sub-steps:**

- **D0.5.1 — Move old onboarding pages out of the way.** Move `app/[locale]/onboarding/page.tsx`, `app/[locale]/onboarding/step/2/page.tsx`, `app/[locale]/onboarding/step/3/page.tsx`, `components/onboarding/StepLayout.tsx`, `components/onboarding/ProgressBar.tsx`, `lib/restaurants/draft.ts` into a `_legacy_c1_c4/` folder at the repo root. They are not deleted yet — we will reference them as we rebuild. Add `_legacy_c1_c4/` to `.gitignore` for ESLint/TS exclusion via `tsconfig.json` `exclude`.
- **D0.5.2 — Create the new directory skeleton.** Empty folders with `.gitkeep` files for:
  - `app/[locale]/onboarding/` (will hold all new step pages)
  - `components/onboarding/shell/` (sidebar, progress bar, layout)
  - `components/onboarding/fields/` (reusable form field components)
  - `components/onboarding/steps/` (step-specific subcomponents)
  - `lib/onboarding/` (helpers: draft saving, step ordering, validators)
  - `app/api/v1/restaurants/` (will hold draft, hours, photo, qr, etc.)
- **D0.5.3 — Verify build is still clean.** `npm run build` passes.

**Verification.** Build is clean, directory structure matches plan, legacy files isolated.

**Gate to next sub-step:** repo ready, legacy isolated.

### D0.6 — Port the survivors

**Purpose.** The KVK lookup, PDOK lookup, photo upload, and draft route from C.2–C.4 still work and are referenced by the new schema. Port them to the new structure without behavioural changes.

**Sub-steps:**

- **D0.6.1 — Port `/api/kvk/search`.** Move the file from its old path (`app/api/kvk/search/route.ts`) to keep its path. Verify it still works (manual hit in browser with a known KVK query).
- **D0.6.2 — Port `/api/kvk/profile`.** Same as above.
- **D0.6.3 — Port `/api/pdok/lookup`.** Same.
- **D0.6.4 — Port `/api/v1/restaurants/photo`.** Same, but the `restaurants` table is now the new schema — verify the column it writes (`hero_image_url`) still exists. In the new schema this column lives on `restaurants` for now, intended to be replaced later by the menu-photo path. Confirm.
- **D0.6.5 — Rewrite `/api/v1/restaurants/draft`.** The draft route's field whitelist changes massively. This is a full rewrite based on Section 4 of the PRD. Whitelist grows from ~10 fields to ~80. Server-side validators per field type. New `GET` returns the full draft including arrays (zones, tables, availability) — not just the `restaurants` row.

**Verification after each:** the route responds correctly to a manual test request. After D0.6.5, the new draft route handles GET (returns null restaurant initially) and PUT (creates a restaurant on first kvk_number write).

**Gate to next phase:** all ported routes verified.

---

## 3. Phase D1 — Onboarding shell

This phase builds the visual and behavioural frame that every onboarding step lives inside. Nothing user-facing yet ships; we set up the chrome first, then fill it.

### D1.1 — The layout

**Purpose.** A two-pane shell: dark sidebar on the left, cream main pane on the right. Built once, reused on every step.

**Sub-steps:**

- **D1.1.1 — `OnboardingShell.tsx`.** Server component at `components/onboarding/shell/OnboardingShell.tsx`. Renders the two-pane structure. Loads the restaurant for the current user (uses `createSupabaseServerClient`). Passes resolved restaurant + service-selection-state to its children. Handles "not logged in" → redirect to `/login`. Handles "restaurant.status = 'live' / pending_review'" → redirect to status page.
- **D1.1.2 — Use `OnboardingShell` in `app/[locale]/onboarding/layout.tsx`.** Replace the legacy layout. Verify a hit to `/onboarding` (with a logged-in user) renders the shell without errors.
- **D1.1.3 — Mobile responsiveness.** At narrow viewports (< 768 px) the sidebar collapses behind a hamburger menu. Implement the collapse and a slide-in panel.

**Verification.** Visually inspect at desktop and mobile widths. Layout looks like the demo (dark sidebar, cream content area). No layout shift on load.

### D1.2 — The sidebar

**Sub-steps:**

- **D1.2.1 — `OnboardingSidebar.tsx`.** Client component. Receives: the resolved restaurant, the current step number, the list of visible steps (computed from service selection). Renders: "THE TAFEL — RESTAURANT SETUP" wordmark, NL/EN toggle, service chips, the numbered step list, "Need help" + "Book a setup call" CTA.
- **D1.2.2 — Step list logic.** Helper at `lib/onboarding/steps.ts` exports `getVisibleSteps(restaurant)` which returns the array of step descriptors visible to this restaurant. Each descriptor: `{ id, label_nl, label_en, path, services: Service[] }`. The PRD's Section 2.2 table is the source of truth.
- **D1.2.3 — Step status rendering.** Each sidebar item renders its state (completed / current / future-reachable / future-unreachable) using `current_onboarding_step` from the restaurant row. Completed = amber circle with check; current = amber outline; future = muted. Click handlers navigate to that step if reachable; do nothing if not.
- **D1.2.4 — Language toggle.** NL/EN pill in the sidebar. Clicking switches the URL prefix (`/en/...` vs root) and persists `profiles.locale`. The next request loads in the chosen language.

**Verification.** Sidebar renders correctly. Step list updates as the restaurant progresses. Language toggle works and persists across reloads.

### D1.3 — The step frame

**Sub-steps:**

- **D1.3.1 — `StepFrame.tsx`.** Client component at `components/onboarding/shell/StepFrame.tsx`. Replaces the legacy `StepLayout`. Renders the thin amber progress bar at top, the "Step X of Y — Service tag" eyebrow, heading (Raleway 900), sub-heading (Jost 300), the children, and the footer (Back / centre indicator / Continue).
- **D1.3.2 — Progress bar component.** Thin (4 px) amber bar at top of main pane, animated transition. Filled portion = `(currentStep / totalVisibleSteps) * 100%`.
- **D1.3.3 — Footer buttons.** Back is hidden on Step 1 (the service picker is Step 0). Continue is disabled until the per-step validation function returns true. The validation function is passed as a prop.
- **D1.3.4 — Error banner.** Inside the frame, above the heading, a slot for a soft-red banner shown when step-level errors occur (network errors, validation failures from the server).

**Verification.** A test page using `<StepFrame>` with placeholder content renders correctly. Footer buttons enable/disable correctly. Progress bar animates.

### D1.4 — Field components

**Purpose.** A library of reusable form field primitives used across all steps.

**Sub-steps:**

- **D1.4.1 — `TextField.tsx`.** Standard input. Props: label, value, onChange, error, hint, maxLength, required. Built once, used everywhere.
- **D1.4.2 — `TextAreaField.tsx`.** Multi-line equivalent.
- **D1.4.3 — `SelectField.tsx`.** Dropdown. Supports option groups.
- **D1.4.4 — `ToggleField.tsx`.** The on/off pill switch in amber, matching the demo's switch style.
- **D1.4.5 — `CardChoice.tsx`.** Large clickable card for plan/service selection (used in Step 0, Step 9 QR plan, Step 12 subscription tiers).
- **D1.4.6 — `FileUploadField.tsx`.** Drag-and-drop upload with progress, validation (MIME, size), preview thumbnail.
- **D1.4.7 — `PostcodeField.tsx`.** Specialised postcode + house number input that calls `/api/pdok/lookup` on debounce. Shows the autofilled street/city.

**Verification.** Each field component renders standalone in a Storybook-style test page (or a dev-only sandbox route). Visual regression check against the brand guidelines.

### D1.5 — Autosave and navigation hooks

**Sub-steps:**

- **D1.5.1 — `useDraftSave.ts`.** React hook at `lib/onboarding/useDraftSave.ts`. Called by each step page. Wraps the `PUT /api/v1/restaurants/draft` call with debouncing, retry-on-fail, and a "Saved" indicator state.
- **D1.5.2 — `useResumeRedirect.ts`.** Hook called by the shell. Resolves where the restaurant should land based on `current_onboarding_step` and `status`. Redirects accordingly.
- **D1.5.3 — Centralised step-routing helper.** `lib/onboarding/routes.ts` exports `stepPath(restaurant, stepNumber)` so navigation between steps uses a single source of truth and respects locale.

**Verification.** Type a value in a TextField on a test page, blur, see the network call hit the draft route, see "Saved" appear briefly. Reload the page — value persists. Force the draft route to fail (Sentry-style throw) — error UI appears, retry happens.

**Gate to next phase:** shell is solid, fields are reusable, autosave is bullet-proof.

---

## 4. Phase D2 — Service picker (Step 0)

The first screen the restaurant sees after signup. Pre-wizard step.

### D2.1 — Page and copy

**Sub-steps:**

- **D2.1.1 — `app/[locale]/onboarding/page.tsx`.** This is the Step 0 page. Three large `CardChoice` cards (Reservations / Takeaway / QR) + one disabled card (Delivery "Coming soon"). A "Set up all three — recommended" hint banner.
- **D2.1.2 — Server-side service-toggle write.** On click of a card, persist `service_*_enabled` via the draft route. The "Set up services" button at the bottom is enabled when at least one is selected.

**Verification.** Picking services persists across reload. Continue advances to Step 1 (currently a placeholder, built next).

### D2.2 — Routing logic

**Sub-steps:**

- **D2.2.1 — Wire the "Set up services" button.** On click: validate at least one selected, set `current_onboarding_step = 1`, navigate to the path of Step 1 (KVK — `/onboarding/business`). The full step path map lives in `lib/onboarding/routes.ts` and uses descriptive names rather than numbers (e.g. `/business`, `/floor-plan`, `/hours`, `/rules`, `/no-shows`, `/guests`, `/ordering`, `/menu`, `/qr-setup`, `/qr-codes`, `/payments`, `/subscription`, `/contract`, `/review`).

**Verification.** Selecting "Reservations only" goes to `/onboarding/business`. Selecting "Takeaway only" also goes to `/business`. Selecting "QR only" also goes to `/business`. (KVK is shared by all.)

**Gate to next phase:** Step 0 fully wired.

---

## 5. Phase D3 — Reservation steps (Steps 1–6)

The longest module. Six steps. Each step is one Build-Plan step subdivided.

### D3.1 — Step 1: Verify your business (KVK)

This step is shared by all services but lives in the Reservation phase since it's the first business-data step.

**Sub-steps:**

- **D3.1.1 — Page skeleton at `app/[locale]/onboarding/business/page.tsx`.** Uses `StepFrame`, sets eyebrow "Step 1 — Identity," heading "Verify your business," sub "Enter your KVK number. We will pull your details from the Dutch Chamber of Commerce register." Empty content section.
- **D3.1.2 — KVK number input + Look-up button.** TextField with the "LOOK UP KVK" button next to it. Below the input: "Try: 12345678, 87654321, 11223344" hint text (visible in dev only; production hides this).
- **D3.1.3 — KVK lookup integration.** On clicking Look-up, call `/api/kvk/search` then `/api/kvk/profile` for the chosen result. The fully-filled card appears below (legal name, KVK number, status, founded year, address, city, director, email, phone, SBI code), as in the demo screenshot.
- **D3.1.4 — SBI guard.** If the returned SBI code is not in the 56.x range, show a soft red message: "This KVK number is registered to a non-restaurant business. Please contact support if you believe this is an error." Continue button stays disabled.
- **D3.1.5 — Editable form below the card.** TextField for display name (defaults to KVK trade name), public phone, public email, cuisine type (SelectField), website. Each field autosaves on blur.
- **D3.1.6 — Continue logic.** Continue enabled when: KVK successfully looked up, SBI valid, display name non-empty. On Continue: advance to Step 2.

**Verification.** Looking up `68750110` (test KVK) returns Test BV Donald in Lollum. SBI code 56.x means the card shows green "KVK VERIFIED." Editable form below pre-fills correctly. Continue advances. Reloading mid-step preserves all entered values.

### D3.2 — Step 2: Floor plan

**Visible only if Reservations enabled.**

**Sub-steps:**

- **D3.2.1 — Page skeleton at `/onboarding/floor-plan/page.tsx`.** Frame, eyebrow "Step 2 — Reservations," heading "Floor plan," sub "Add zones and tables for table reservations."
- **D3.2.2 — Live summary tiles.** Four tiles showing total tables, total seats, total zones, max guests per shift. Update in real time as the restaurant builds the layout.
- **D3.2.3 — Table-size selector row.** Five buttons (2p / 4p / 6p / 8p / 10p). Clicking one selects the current size for the next table to be added.
- **D3.2.4 — Zone columns.** Default zone "Binnenzaal" pre-created. "+ Zone" button at top right adds a new zone (modal asks for name). Each zone column shows its tables in a vertical list, each row showing label + seats + an X to remove.
- **D3.2.5 — Add-table interaction.** Inside each zone, an "+ Add" link adds a table of the currently selected size. Auto-labels T1, T2, T3... in insertion order per restaurant (not per zone).
- **D3.2.6 — Zone/table API routes.** Create `app/api/v1/restaurants/zones/route.ts` (POST creates zone; DELETE removes) and `app/api/v1/restaurants/tables/route.ts` (POST creates, PUT edits, DELETE removes). Both auth-checked, RLS-enforced.
- **D3.2.7 — Occupancy duration dropdown.** SelectField with default 90 min. Add "Per party size" option which expands into a small JSON editor (mini-grid for 2p..10p → minutes).
- **D3.2.8 — Turnover buffer dropdown.** SelectField default 15 min.
- **D3.2.9 — Continue logic.** Enabled when ≥ 1 zone with ≥ 1 table exists, occupancy duration set.

**Verification.** Add Binnenzaal with T1 (2p) + T2 (4p) + T3 (4p) + T4 (6p), add Terras with T5 (2p) + T6 (4p). Counters show 6 tables, 22 seats, 2 zones, 19 max/shift (rough average shifts calculation). Refresh — everything persists.

### D3.3 — Step 3: Opening hours

**Visible for all services.**

**Sub-steps:**

- **D3.3.1 — Page skeleton at `/onboarding/hours/page.tsx`.**
- **D3.3.2 — Seven day-rows.** Each row: day label (Ma, Di, Wo, Do, Vr, Za, Zo), on/off toggle, open-time input, close-time input, and three service-tag pills (Brunch / Lunch / Dinner). Layout matches the demo screenshot.
- **D3.3.3 — Slot interval + kitchen-closes-offset dropdowns.** Below the seven rows.
- **D3.3.4 — Per-service override toggle.** "Use different hours per service" toggle at the bottom. When on, the seven rows triplicate (one set per service the restaurant has enabled).
- **D3.3.5 — Availability route.** `app/api/v1/restaurants/hours/route.ts` — PUT replaces all `availability` rows for this restaurant in one transaction. (This is the same route we sketched in C.5; the body shape is updated to handle `service_scope`.)
- **D3.3.6 — Validation.** At least one day enabled. For each enabled day, close > open (with the `closes_next_day` flag for past-midnight handling).

**Verification.** Set Tuesday–Sunday 12:00–22:00 (Tuesday close 22:00, Thursday close 22:30, Friday/Saturday 23:00, Sunday 21:00). Verify the `availability` table has 6 rows. Toggle per-service override → 18 rows. Toggle back → cleans up to 6 rows again.

### D3.4 — Step 4: Booking rules

**Visible only if Reservations enabled.**

**Sub-steps:**

- **D3.4.1 — Page skeleton at `/onboarding/rules/page.tsx`.**
- **D3.4.2 — Six dropdown/toggle fields.** Min lead time, max party size, booking window, max guests per slot, waitlist toggle, guest zone preference toggle. All persist via draft autosave.

**Verification.** Set min lead time = 1 hour, max party = 8, booking window = 90 days, max guests/slot = no limit, waitlist on, zone preference on. Refresh → persists.

### D3.5 — Step 5: No-show protection

**Visible only if Reservations enabled.**

**Sub-steps:**

- **D3.5.1 — Page skeleton at `/onboarding/no-shows/page.tsx`.**
- **D3.5.2 — Six-tile grid (3×2).** Each tile renders an `Option` component: icon (custom inline SVG), label, description, status badge.
- **D3.5.3 — Active tiles.** Reminders (default selected, email always on, WhatsApp visible-but-Premium-gated), Reconfirmation (selectable), Prepaid bookings (selectable; disabled with explanation if Mollie not yet connected — but at this step Mollie isn't connected yet, so this tile shows a "Becomes available after payment connection in Step 11" hint).
- **D3.5.4 — Disabled tiles.** Credit-card guarantee and AI predictor are visibly disabled with "Coming soon" badge. Click does nothing.
- **D3.5.5 — Prepaid amount input.** When prepaid bookings tile is selected, an amount input (in EUR cents internally, displayed as currency) appears.

**Verification.** Reminders is on by default. WhatsApp toggle inside Reminders shows "Premium plan" lock. Reconfirmation toggleable. Prepaid amount input only shows when prepaid is selected. CC guarantee + AI predictor visibly disabled.

### D3.6 — Step 6: Guest experience

**Visible only if Reservations enabled.**

**Sub-steps:**

- **D3.6.1 — Page skeleton at `/onboarding/guests/page.tsx`.**
- **D3.6.2 — Confirmation template textarea + variables row.** Above the textarea: a small row of clickable pill-tokens (`{naam}`, `{restaurant}`, `{datum}`, `{tijd}`, `{gasten}`, `{adres}`) that insert the token at the cursor when clicked.
- **D3.6.3 — Live preview pane.** To the right of the textarea, a preview rendering the template with sample data (Maria, Trattoria Roma, Vrijdag 9 mei, 19:30, 2 gasten, Ceintuurbaan 28). Updates as the template is edited.
- **D3.6.4 — Booking questions toggles.** Three toggle rows: Allergies, Special occasion, Special requests. Each on by default.

**Verification.** Default template renders correctly in preview. Editing the template updates the preview. Toggles persist.

**Gate to next phase:** all six Reservation steps complete and resumable.

---

## 6. Phase D4 — Takeaway steps (Steps 7, 8)

### D4.1 — Step 7: Online ordering settings

**Visible only if Takeaway enabled.**

**Sub-steps:**

- **D4.1.1 — Page skeleton at `/onboarding/ordering/page.tsx`.**
- **D4.1.2 — Six fields.** Prep time (dropdown), Min order (currency input), Pickup slot interval (dropdown), Accept online orders toggle, Allow item notes toggle, Scheduled orders toggle.

**Verification.** Set prep = 20, min order = €0, slot interval = 15, accept on, item notes on, scheduled off. Refresh persists.

### D4.2 — Step 8: Menu upload

**Visible if Takeaway or QR enabled.**

**Sub-steps:**

- **D4.2.1 — Page skeleton at `/onboarding/menu/page.tsx`.**
- **D4.2.2 — File upload zone.** `FileUploadField` configured for menu files (PDF + image types, max 20 MB, up to 5 files). Server endpoint: `app/api/v1/restaurants/menu-source/route.ts` (POST multipart). Files go to the `restaurant-menu-sources` Supabase Storage bucket at path `{restaurant_id}/menu/{upload_id}.{ext}`. Writes `menu_source_uploads` row per file.
- **D4.2.3 — Cuisine description textarea.** Optional but recommended.
- **D4.2.4 — Photos upload zone.** Optional, separate from the menu file. Uploads to `restaurant-menu-sources` bucket at path `{restaurant_id}/photos/{upload_id}.{ext}` with `upload_type='photo'`.
- **D4.2.5 — Design preferences textarea.** Optional.
- **D4.2.6 — Same-menu toggle.** Only visible if both Takeaway AND QR enabled. "Use the same menu for both takeaway and QR ordering?" default ON. When OFF, the upload zone splits into two sections (Takeaway menu / QR menu).
- **D4.2.7 — File previews and delete.** Uploaded files appear as small cards with filename, file size, and a delete button. Deleting calls `DELETE /api/v1/restaurants/menu-source/{id}`.

**Verification.** Upload a sample PDF — appears as a preview card. Delete — removed from list and from storage. Refresh — uploaded files persist. Toggle same-menu OFF and back ON without losing files.

**Gate to next phase:** menu upload solid.

---

## 7. Phase D5 — QR steps (Steps 9, 10)

### D5.1 — Step 9: QR setup & plan

**Visible only if QR enabled.**

**Sub-steps:**

- **D5.1.1 — Page skeleton at `/onboarding/qr-setup/page.tsx`.**
- **D5.1.2 — Plan selection cards.** Two `CardChoice` cards: QR Basic (€119) and QR Premium (€269). Premium card shows "Requires Premium subscription" lock if the restaurant hasn't selected Premium tier in Step 12 yet. Selection persists to `restaurants.qr_plan`.
- **D5.1.3 — Other QR settings.** Auto-accept toggle, item notes toggle, menu language SelectField (NL / EN / NL + EN), accent colour picker.

**Verification.** Pick QR Basic; refresh persists. Switch to Premium; if subscription isn't Premium, see lock state.

### D5.2 — Step 10: QR codes

**Visible only if QR enabled.**

**Sub-steps:**

- **D5.2.1 — Page skeleton at `/onboarding/qr-codes/page.tsx`.**
- **D5.2.2 — Table list.** If Reservations is enabled, reuse the floor-plan tables. If not, present a simplified inline table editor (zones + tables) reusing the same components from Step 2.
- **D5.2.3 — Per-table QR toggle.** Each table has a "QR enabled" toggle (writes `restaurant_tables.is_qr_enabled`). Default on for tables created in this step; respects existing value otherwise.
- **D5.2.4 — Generate QR codes endpoint.** `app/api/v1/restaurants/qr/generate/route.ts` (POST). For each QR-enabled table without a `qr_token`, generate a 22-char URL-safe token, render the QR PNG via the `qrcode` npm package, upload to `qr-codes` bucket at `{restaurant_id}/{table_id}.png`. Write back `qr_token` and `qr_image_path` on the table row.
- **D5.2.5 — Generate button + previews.** "Generate QR codes" primary button. After generation, table cards show a small QR thumbnail and a Download button (signed URL to the PNG). A "Download all" button bundles them into a ZIP via a server endpoint.
- **D5.2.6 — Regenerate option.** Per-table "Regenerate" link rotates the token (useful if a card is lost).

**Verification.** Generate codes for 6 tables. Each one is a unique URL. PNG previews appear. Download a single one — opens a QR. Download all — ZIP works.

**Gate to next phase:** QR codes generated, stored, downloadable.

---

## 8. Phase D6 — Payment connection (Step 11)

This is the most third-party-dependent step. Mollie sets the rhythm.

### D6.1 — Mollie API plumbing

**Sub-steps:**

- **D6.1.1 — Install the Mollie Node SDK** (`@mollie/api-client`). Add `MOLLIE_API_KEY` env var (test key in dev, live key in production). Create `lib/mollie/client.ts` that initialises the SDK server-side only.
- **D6.1.2 — Mollie webhook endpoint.** `app/api/mollie/webhook/route.ts`. Handles `organization.updated`, `payment.paid`, `payment.failed`, `subscription.charged`, `subscription.cancelled`, `mandate.revoked`. Verifies the Mollie signature on every request. Writes to `mollie_webhook_events` for idempotency. Updates the relevant `restaurants` / `subscriptions` / `payments` rows. Writes an `audit_logs` entry per event.
- **D6.1.3 — Webhook URL in production.** Configure Mollie's webhook endpoint URL in the Mollie dashboard. For dev: use ngrok or Mollie's webhook simulator.

**Verification.** Hit the webhook endpoint manually with a valid-shape Mollie payload (use the SDK's test helpers) — it processes, writes an event row, and is idempotent on retry.

### D6.2 — Mollie onboarding hand-off

**Sub-steps:**

- **D6.2.1 — Page skeleton at `/onboarding/payments/page.tsx`.** Eyebrow "Step 11 — Payments," heading "Connect payments." Sub-heading explains Mollie Connect and what doesn't get stored.
- **D6.2.2 — Mollie-create-organisation route.** `app/api/v1/restaurants/mollie/init/route.ts` (POST). Creates a Mollie organisation under the platform using the restaurant's KVK data. Writes back `mollie_organization_id`, `mollie_status = 'pending'`, `mollie_initiated_at`. Returns the hosted-onboarding URL.
- **D6.2.3 — "Set up payments with Mollie" CTA.** Primary button. On click, calls the init route, then opens the returned hosted URL in a new tab. Status indicator on the page polls (or subscribes to a realtime channel) for the `mollie_status` change.
- **D6.2.4 — Polling.** Every 10 seconds while the page is open, hit `GET /api/v1/restaurants/mollie/status`. If `mollie_status` transitions to `verified`, show success state. If `rejected` or `needs_action`, show a "needs attention" state with a re-link button.

**Verification.** Initiate Mollie onboarding (test env). Mollie returns a hosted URL. Webhook eventually marks the restaurant verified. The polling on the page picks it up. The Continue button is **enabled regardless of verification status** (this step does not block).

### D6.3 — Continue with pending Mollie

**Sub-steps:**

- **D6.3.1 — Banner on later screens.** A subtle banner (top of the main pane) appears on Steps 12+ if `mollie_status ≠ 'verified'`: "Payment setup is being processed by Mollie — usually within an hour. Takeaway will go live once verified."
- **D6.3.2 — Continue criteria.** Step 11 Continue requires only that the Mollie onboarding has been **initiated** (`mollie_organization_id` is non-null). Verification is not blocking.

**Verification.** Skip-but-not-skip: clicking Set up payments creates the org, the page shows pending, Continue is enabled. Refresh persists state.

**Gate to next phase:** Mollie wired, webhook works, restaurant can move on without verification completing.

---

## 9. Phase D7 — Subscription + contract (Steps 12, 13)

### D7.1 — Step 12: Subscription

**Sub-steps:**

- **D7.1.1 — Page skeleton at `/onboarding/subscription/page.tsx`.**
- **D7.1.2 — Three tier cards.** Starter (€0), Plus (€49), Premium (€99). Each card shows its inclusions (placeholder text until your team finalises). Tier selection persists to `restaurants.subscription_tier`.
- **D7.1.3 — One-time fees summary.** Below the tiers, a clear breakdown panel:
  - QR Basic setup: €119 (only if `qr_plan = 'basic'`)
  - QR Premium setup: €269 (only if `qr_plan = 'premium'`)
  - Extra tables beyond 20: €11 × (tables - 20), only if applicable
  - **Total due today**: sum of the above
  - "Subscription begins on day 85 — no charge during 84-day trial"
- **D7.1.4 — Mandate-setup route.** `app/api/v1/restaurants/mollie/mandate/route.ts` (POST). Initiates Mollie recurring mandate creation. Returns the hosted-checkout URL.
- **D7.1.5 — One-time-payment route.** `app/api/v1/payments/onetime/route.ts` (POST). Creates a Mollie one-time payment for the total of QR setup + extra tables. Returns the hosted-payment URL.
- **D7.1.6 — Submission flow.** Continue from Step 12 does this in order:
  1. Persist `subscription_tier`.
  2. Create the `subscriptions` row with `status = 'trialing'` and the 84-day trial end date.
  3. If one-time fees > 0: initiate the one-time payment, redirect to Mollie hosted page. After payment, Mollie redirects back to a return URL that confirms the payment and advances to Step 13.
  4. If one-time fees = 0 (Starter tier, no QR): skip the payment step, advance directly.
  5. The recurring mandate flow is initiated in the background — handled separately by Mollie's hosted flow during the one-time payment if Mollie supports it; otherwise a follow-up step in the dashboard after launch.

**Verification.** Pick Premium tier with QR Premium (€269) and 22 tables (2 extra = €22) → total due today = €291. Initiate payment, complete in Mollie test env, return to The Tafel, the `payments` table has a `paid` row, `subscriptions.status = 'trialing'`, advance to Step 13.

### D7.2 — Step 13: Contract & e-sign

**Sub-steps:**

- **D7.2.1 — Page skeleton at `/onboarding/contract/page.tsx`.**
- **D7.2.2 — Contract content renderer.** The contract template is stored as a versioned Markdown file in the repo at `lib/contracts/v1.0/contract_nl.md` and `contract_en.md`. Variables (restaurant name, KVK, tier, total fees, trial end date) are interpolated at render time. The full text renders inside a scrollable container.
- **D7.2.3 — Scroll-to-bottom detection.** Until the user has scrolled to the bottom, the signature box is disabled with a "Please read the full contract" overlay.
- **D7.2.4 — Signature inputs.** Once enabled: typed-name TextField + signature canvas + "I am authorised" checkbox.
- **D7.2.5 — Sign endpoint.** `app/api/v1/restaurants/contract/sign/route.ts` (POST). Validates all signature inputs, renders the signed contract to PDF (using `pdfkit` or similar server-side), uploads the PDF to the `contracts` bucket, uploads the signature canvas PNG too, writes the `contracts` row.
- **D7.2.6 — PDF emailed to the restaurant.** Resend sends a copy of the PDF to `contact_email`.
- **D7.2.7 — Continue.** Advance to Step 14.

**Verification.** Sign the contract end-to-end. The `contracts` table has a row with all fields populated. The PDF in storage is downloadable and renders correctly. Email arrives at the test inbox.

**Gate to next phase:** subscription and contract done.

---

## 10. Phase D8 — Submit, review, go-live (Step 14)

### D8.1 — Submission

**Sub-steps:**

- **D8.1.1 — Page skeleton at `/onboarding/review/page.tsx`.**
- **D8.1.2 — Read-only summary checklist.** Each visible step gets a row: green check + label + summary (e.g. "Floor plan — 6 tables across 2 zones").
- **D8.1.3 — Submit-for-review endpoint.** `app/api/v1/restaurants/submit/route.ts` (POST). Sets `restaurants.status = 'pending_review'`, `restaurants.submitted_at = now()`, creates a `review_tasks` row, audit-logs the event, emails the admin.
- **D8.1.4 — Submission confirmation screen.** Replaces the page content after submission. Shows "Submitted — typically reviewed within 60 minutes. We'll email you when you're live." with a countdown to a 60-minute marker (soft, not enforced).

**Verification.** Submission persists the state correctly. The admin email arrives.

### D8.2 — Admin review surface

**Purpose.** The Tafel staff need a way to see and approve pending reviews. This is a temporary lightweight admin UI built into the onboarding system; the full admin tool is a separate later build.

**Sub-steps:**

- **D8.2.1 — Admin allowlist.** Add `lib/auth/admins.ts` exporting `isAdmin(user)` based on a comma-separated `ADMIN_EMAILS` env var. Server-side only.
- **D8.2.2 — Admin review list page.** `/admin/reviews` (gated to admins). Lists all `review_tasks` with `status = 'pending'`, sorted by `submitted_at`. Each row links to a detail page.
- **D8.2.3 — Admin review detail page.** `/admin/reviews/{restaurant_id}`. Shows the full restaurant data side-by-side with the team's notes textarea. Two primary buttons: "Approve & Go Live" and "Mark Needs Follow-up" (the second triggers an internal comms task — no rejection; courtesy review only per PRD).
- **D8.2.4 — Approve endpoint.** `app/api/admin/review/approve/route.ts` (POST). Sets `restaurants.status = 'live'`, `restaurants.went_live_at = now()`, marks the `review_tasks` row approved, audit-logs, and triggers the "You're live" email to the restaurant.
- **D8.2.5 — Live notification email.** Resend template — sent to the restaurant when approved. Contains the public URL (`thetafel.nl/{slug}`), the web-app login URL, and a brief note on which services are live now vs pending (takeaway awaits Mollie + menu; QR awaits menu + card shipment).

**Verification.** Log in as an admin email, see the reviews list. Click into a pending review, click approve, see the restaurant transition to live, see the email arrive.

### D8.3 — The "You're live" screen

**Sub-steps:**

- **D8.3.1 — When `restaurants.status = 'live'`,** any visit to `/onboarding/*` redirects to `/onboarding/live`. This is the "You're live" page from the PRD (Section 4 of the PRD).
- **D8.3.2 — Page content.** Welcoming heading, the public URL, a description of staggered go-live, "Open your restaurant web app →" button. The web-app login target is `https://app.thetafel.nl/login` (or whatever the dashboard URL turns out to be — a placeholder env var `NEXT_PUBLIC_DASHBOARD_URL` is set now and updated when the dashboard is built).

**Verification.** Approved restaurant visiting `/onboarding` lands on the You're Live screen. The button is functional (even if the dashboard isn't built yet — it can simply 404 for now, since the dashboard PRD covers it).

**Gate to next phase:** end-to-end submission + approval + go-live works.

---

## 11. Phase D9 — Hardening, ops, polish

The work that turns a working onboarding into a production-ready one.

### D9.1 — Security and rate limiting verification

**Sub-steps:**

- **D9.1.1 — RLS test suite.** Write Vitest tests (or similar) that simulate two different users and confirm cross-tenant data is invisible. Run via `npm test`. Tests live in `tests/security/rls.test.ts`.
- **D9.1.2 — Rate-limit verification.** For each rate-limited endpoint, write a test (or manual check) that confirms the limit is enforced. Document the actual numbers observed.
- **D9.1.3 — CSP header verification.** Hit a deployed page, inspect headers, confirm the strict CSP is in place. Use `csp-evaluator.withgoogle.com` to score it.
- **D9.1.4 — Secret audit.** Confirm no service-role keys, Mollie keys, KVK keys are in `NEXT_PUBLIC_*` env vars. Confirm none are committed in the repo (grep for the prefixes of each key type).

### D9.2 — Audit logging

**Sub-steps:**

- **D9.2.1 — Helper function.** `lib/audit/log.ts` exporting `auditLog(event_type, restaurant_id, event_data)`. Called from every sensitive route handler.
- **D9.2.2 — Wire audit calls.** Add `auditLog` calls to: login events (in Phase B's auth, retroactively), every Mollie webhook, every contract sign, every admin action, every payment.
- **D9.2.3 — Verification.** Trigger a representative set of actions and inspect the `audit_logs` table — every expected event has a row.

### D9.3 — Performance budgets

**Sub-steps:**

- **D9.3.1 — Lighthouse run.** Run Lighthouse on the deployed Step 0 and Step 1 pages. Targets: Performance ≥ 90, Accessibility ≥ 95.
- **D9.3.2 — Database query plans.** For each onboarding endpoint, run `EXPLAIN ANALYZE` in the Supabase SQL editor on the representative query. Confirm index usage on each. Document the results in `docs/QUERY_PLANS.md`.
- **D9.3.3 — Bundle-size check.** Run `next build` and confirm the per-route JS bundles are < 200 KB transferred.

### D9.4 — GDPR checklist

**Sub-steps:**

- **D9.4.1 — Cookie footnote.** Implement the small first-visit footnote per PRD §12.6. Stored as a cookie itself.
- **D9.4.2 — Data export endpoint stub.** `app/api/v1/restaurants/export/route.ts` (GET). Returns a JSON dump of all the restaurant's data. Used for GDPR portability requests.
- **D9.4.3 — DPA copy verification.** Confirm the contract Markdown templates contain the DPA section.

### D9.5 — Polish pass

**Sub-steps:**

- **D9.5.1 — Visual review.** Click through the whole flow end to end at desktop and mobile widths. Note any visual issues — spacing, colours, copy. Fix iteratively.
- **D9.5.2 — Dutch copy review.** Have a native Dutch speaker on your team review every Dutch string in the flow. Adjust as needed.
- **D9.5.3 — Error-path testing.** Deliberately trigger every error case (network off, KVK API timeout, Mollie webhook failure, storage quota exceeded). Confirm each surfaces a sensible message.
- **D9.5.4 — End-to-end smoke test.** A fresh restaurant onboards from signup → live. Document the time it took, any friction, anything that broke. Fix the friction items.

**Gate to launch:** all D9 sub-steps green. The onboarding is ready for first real users.

---

## 12. Cross-cutting working rules

These apply to every sub-step.

### 12.1 Code-file delivery format

Claude never pastes long code into chat. Every code change is delivered as a Markdown prompt file (named `dN_M_K_description_prompt.md` where N = phase, M = step, K = sub-step) containing:

1. A one-paragraph summary of what the change is.
2. The exact file path(s) being created or modified.
3. The full file content (no partial files, no "add the rest yourself").
4. The verification step.

You paste the prompt into Claude Code, save, build.

### 12.2 Per-sub-step commits

After every passing sub-step: `git add . && git commit -m "DN.M.K: short description" && git push origin main`. We do not let a sub-step linger un-committed.

### 12.3 Database migrations are immutable

Once applied to `thetafel-prod`, a migration file is never edited. Corrections happen via a new migration. The migrations directory `supabase/migrations/` is the historical record.

### 12.4 Build must stay green

After every sub-step, `npm run build` must pass with no TypeScript errors and no new ESLint warnings. A broken build is the next sub-step's first task; we do not stack work on top of a broken build.

### 12.5 Don't skip steps

The PRD is the source of truth for *what* exists. This build plan is the source of truth for *what order it's built in*. If during the build we discover something missing from the PRD, we STOP, update the PRD, then proceed. We do not silently invent.

### 12.6 The voice-recognition charity rule

Voice typos and casual phrasing in chat messages are interpreted charitably. Confirmation questions are only asked when the intent is genuinely unclear.

---

## 13. What this plan does not cover

- **Phase E — Restaurant dashboard / web app build plan.** Built once the dashboard PRD (Part 2) is approved.
- **Phase F — Diner-facing pages build plan.** Built once the diner PRD (Part 3) is approved.
- **The booking engine implementation.** This is part of Phase E, since the engine runs in the dashboard's context (live order/booking feed) and the diner pages only call its endpoints.
- **Admin tooling beyond the minimal review surface in D8.2.** Full admin tools are a later, separate effort.
- **Real-time order/booking subscriptions.** Built in Phase E.

---

## 14. Estimated effort and pacing

To set realistic expectations, an approximate effort estimate:

| Phase | Sub-steps | Approx. working sessions |
|---|---|---|
| D0 | 13 | 3–4 |
| D1 | 14 | 4–5 |
| D2 | 3 | 1 |
| D3 | 30 | 8–10 |
| D4 | 9 | 3 |
| D5 | 10 | 3 |
| D6 | 7 | 2–3 |
| D7 | 11 | 4 |
| D8 | 8 | 3 |
| D9 | 14 | 4 |
| **Total** | **~120** | **~35–45 sessions** |

A working session is a focused 1–2 hour block. At the rhythm of C.1–C.4 (which averaged about 2 sub-steps per session), the onboarding build is **roughly 6–10 weeks of part-time work**.

---

## 15. End of plan

This document, alongside the PRD and the schema file, is the complete blueprint for the onboarding system. The next step is execution: D0.1.1.

When you're ready, say "let's begin D0.1.1" and we start.

Subsequent documents:

- **TheTafel_Dashboard_PRD_v1.0** — Part 2 of the system.
- **TheTafel_Dashboard_BuildPlan_v1.0** — its build plan.
- **TheTafel_DinerFacing_PRD_v1.0** — Part 3 of the system.
- **TheTafel_DinerFacing_BuildPlan_v1.0** — its build plan.