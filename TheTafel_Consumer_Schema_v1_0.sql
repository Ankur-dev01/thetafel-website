-- =============================================================================
-- The Tafel — Phase 2 Consumer-Facing Schema
-- TheTafel_Consumer_Schema_v1.0.sql
-- =============================================================================
-- Companion to TheTafel_Consumer_PRD_v1.0.md (§7 schema spec) and
-- TheTafel_Consumer_BuildPlan_v1.0.md (C1 — schema additions phase).
--
-- This file is THE source of truth for Phase 2 schema. Differences between
-- this file and the live database are bugs to reconcile, not features.
--
-- Run order: apply this entire file in a single transaction via Supabase MCP
-- `apply_migration`. The file is idempotent — re-applying is safe and reports
-- "already exists" for objects that already exist.
--
-- Conventions used throughout this file:
--   * snake_case for all identifiers
--   * UTC timestamptz for every timestamp; no naive timestamps anywhere
--   * SERIAL/BIGSERIAL not used; UUIDs via gen_random_uuid() for all primary keys
--   * Every monetary column has a paired currency column defaulting to 'EUR'
--     (PRD §17.3 — multi-currency expansion without migration)
--   * Every table that mutates carries an updated_at column with a trigger
--   * RLS enabled on every table; no exceptions
--   * Comments document WHY for any non-obvious decision
-- =============================================================================

-- Wrap the whole file in a transaction so partial application doesn't leave
-- the DB in a half-migrated state.
BEGIN;

-- Ensure required extensions are loaded.
CREATE EXTENSION IF NOT EXISTS pgcrypto;          -- gen_random_uuid(), digest()
CREATE EXTENSION IF NOT EXISTS pg_trgm;           -- trigram indexes for fuzzy search (menu search later)


-- =============================================================================
-- 1. ENUMS
-- =============================================================================
-- Postgres CREATE TYPE does not support IF NOT EXISTS for enums. Each is
-- wrapped in a DO block that checks pg_type first. Adding values to existing
-- enums later uses ALTER TYPE ... ADD VALUE which is a separate migration.
-- -----------------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE booking_status AS ENUM (
        'pending',      -- created, awaiting any external confirmation (rare; most go straight to confirmed)
        'confirmed',    -- live booking; will be shown in restaurant's today list
        'cancelled',    -- guest or restaurant cancelled before slot
        'attended',     -- guest arrived; restaurant marked attended (Phase 3 dashboard)
        'no_show'       -- guest did not arrive within grace period; triggers deposit capture if applicable
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM (
        'pending',      -- created, awaiting payment for pay-now path
        'confirmed',    -- payment received OR pay-at-table accepted; sent to kitchen
        'preparing',    -- kitchen acknowledged
        'ready',        -- ready to serve (QR) or ready for pickup (takeaway); triggers guest notification
        'served',       -- delivered to table (QR only)
        'completed',    -- guest picked up / tab closed / fully done
        'cancelled',    -- cancelled by guest or restaurant
        'refunded'      -- payment fully refunded after cancellation
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_intent_status AS ENUM (
        'pending',                -- created, Mollie redirect in flight
        'paid',                   -- terminal; funds captured
        'failed',                 -- terminal; Mollie rejected or timed out
        'cancelled',              -- terminal; guest cancelled at Mollie checkout
        'refunded',               -- terminal; full refund processed
        'partially_refunded'      -- terminal; partial refund (Phase 3 feature)
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE payment_intent_purpose AS ENUM (
        'deposit',          -- no-show deposit for a reservation
        'qr_order',         -- QR ordering payment
        'takeaway_order',   -- takeaway pre-payment
        'subscription',     -- restaurant → Tafel monthly fee (Phase 1, listed here for completeness)
        'qr_setup_fee'      -- one-time fee at onboarding step 11 (Phase 1)
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE order_type AS ENUM ('qr', 'takeaway');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE magic_link_purpose AS ENUM (
        'manage_booking',   -- guest cancels or views their booking
        'view_order',       -- guest views order status
        'cancel_booking'    -- explicit cancel-only token (single-use)
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;


-- =============================================================================
-- 2. NEW COLUMNS ON THE EXISTING `restaurants` TABLE
-- =============================================================================
-- Phase 1 created many of these already during onboarding. Each ADD COLUMN
-- uses IF NOT EXISTS so re-applying is safe. The PRD §7.2 is authoritative;
-- this section explicitly names every column required by Phase 2.
-- -----------------------------------------------------------------------------

ALTER TABLE public.restaurants
    -- No-show protection (some already exist from Phase 1 step 5)
    ADD COLUMN IF NOT EXISTS noshow_prepaid_enabled        BOOLEAN     NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS noshow_prepaid_threshold      SMALLINT,                              -- min party size that triggers deposit; NULL = always
    ADD COLUMN IF NOT EXISTS noshow_prepaid_amount_cents   INTEGER,                                -- per person; total = amount * party_size
    ADD COLUMN IF NOT EXISTS noshow_prepaid_currency       TEXT        NOT NULL DEFAULT 'EUR',
    ADD COLUMN IF NOT EXISTS noshow_prepaid_window         JSONB,                                  -- JSON describing day/time windows when deposit applies

    -- QR pay-mode toggles (Phase 1 step 9 set qr_plan but not these specifically)
    ADD COLUMN IF NOT EXISTS qr_pay_now_enabled            BOOLEAN     NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS qr_pay_at_table_enabled       BOOLEAN     NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS qr_item_notes_enabled         BOOLEAN     NOT NULL DEFAULT TRUE,     -- whether guests can add "no onions" per item

    -- Booking window
    ADD COLUMN IF NOT EXISTS min_lead_time_minutes         SMALLINT    NOT NULL DEFAULT 120,      -- earliest booking is now + this many minutes
    ADD COLUMN IF NOT EXISTS max_party_size_online         SMALLINT    NOT NULL DEFAULT 8,        -- parties above this must contact restaurant
    ADD COLUMN IF NOT EXISTS booking_window_days           SMALLINT    NOT NULL DEFAULT 60,       -- how far in advance bookings allowed

    -- Public-facing info (some exist from Phase 1)
    ADD COLUMN IF NOT EXISTS photo_url                     TEXT,                                   -- header photo on consumer pages
    ADD COLUMN IF NOT EXISTS neighbourhood                 TEXT,                                   -- shown next to cuisine on header
    ADD COLUMN IF NOT EXISTS phone_public                  TEXT,                                   -- E.164; phone shown publicly (may differ from owner's contact phone)

    -- Phase 4 forward-compat (PRD §17.6)
    ADD COLUMN IF NOT EXISTS marketplace_visible           BOOLEAN     NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS marketplace_priority          SMALLINT    NOT NULL DEFAULT 0;        -- higher = featured higher

-- Document the new constraints
ALTER TABLE public.restaurants
    DROP CONSTRAINT IF EXISTS restaurants_noshow_threshold_check,
    ADD CONSTRAINT restaurants_noshow_threshold_check
        CHECK (noshow_prepaid_threshold IS NULL OR noshow_prepaid_threshold >= 1);

ALTER TABLE public.restaurants
    DROP CONSTRAINT IF EXISTS restaurants_noshow_amount_check,
    ADD CONSTRAINT restaurants_noshow_amount_check
        CHECK (noshow_prepaid_amount_cents IS NULL OR noshow_prepaid_amount_cents >= 0);

ALTER TABLE public.restaurants
    DROP CONSTRAINT IF EXISTS restaurants_min_lead_check,
    ADD CONSTRAINT restaurants_min_lead_check
        CHECK (min_lead_time_minutes >= 0 AND min_lead_time_minutes <= 10080); -- max 7 days

ALTER TABLE public.restaurants
    DROP CONSTRAINT IF EXISTS restaurants_max_party_check,
    ADD CONSTRAINT restaurants_max_party_check
        CHECK (max_party_size_online >= 1 AND max_party_size_online <= 20);

ALTER TABLE public.restaurants
    DROP CONSTRAINT IF EXISTS restaurants_booking_window_check,
    ADD CONSTRAINT restaurants_booking_window_check
        CHECK (booking_window_days >= 1 AND booking_window_days <= 365);


-- =============================================================================
-- 3. NEW TABLES
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 3.1 guests
-- ---------------------------------------------------------------------------
-- One row per unique (email_lower, phone). PII is here; bookings and orders
-- reference this row instead of duplicating contact details. PRD §2.4.
--
-- GDPR erasure note: guests are NEVER hard-deleted (transactional records
-- must be retained 7 years per Dutch tax law). Erasure is implemented as
-- soft-anonymisation: PII columns get hashed/placeholder values, anonymised_at
-- is set. The booking/order rows survive but no longer point to identifiable
-- data. See lib/gdpr/anonymiseGuest.ts (Phase 2 C8.3).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.guests (
    id                      UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name               TEXT                NOT NULL,
    email                   TEXT                NOT NULL,
    -- email_lower is a generated column so the unique index is case-insensitive
    -- without needing application-layer discipline. Updates to `email` propagate
    -- automatically.
    email_lower             TEXT                GENERATED ALWAYS AS (lower(email)) STORED,
    phone                   TEXT                NOT NULL,                                       -- E.164 format
    marketing_consent       BOOLEAN             NOT NULL DEFAULT FALSE,
    marketing_consent_at    TIMESTAMPTZ,
    -- Phase 5 reserved (PRD §17.9) — loyalty programme
    loyalty_points          INTEGER             NOT NULL DEFAULT 0,
    loyalty_tier            TEXT                NOT NULL DEFAULT 'standard',
    -- Soft-anonymisation tracking
    anonymised_at           TIMESTAMPTZ,                                                         -- NULL until GDPR erasure
    created_at              TIMESTAMPTZ         NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ         NOT NULL DEFAULT now(),

    CONSTRAINT guests_email_check        CHECK (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    CONSTRAINT guests_phone_check        CHECK (phone ~ '^\+[1-9][0-9]{1,14}$'),
    CONSTRAINT guests_loyalty_points_check CHECK (loyalty_points >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS guests_email_phone_unique
    ON public.guests (email_lower, phone)
    WHERE anonymised_at IS NULL;

CREATE INDEX IF NOT EXISTS guests_email_lower_idx ON public.guests (email_lower);
CREATE INDEX IF NOT EXISTS guests_phone_idx       ON public.guests (phone);

COMMENT ON TABLE public.guests IS
    'Anonymous guest dedupe by (email_lower, phone). Never hard-deleted; GDPR erasure is soft-anonymisation via anonymised_at + PII overwrite.';


-- ---------------------------------------------------------------------------
-- 3.2 bookings
-- ---------------------------------------------------------------------------
-- Reservation rows. One booking can reference multiple tables via the
-- booking_tables join (PRD §17.2 — supports Phase 4 group bookings, splits,
-- merges without schema change).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.bookings (
    id                      UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id           UUID                NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    guest_id                UUID                NOT NULL REFERENCES public.guests(id) ON DELETE RESTRICT,
    booking_ref             TEXT                NOT NULL UNIQUE,                                -- format XXX-XXXX, generated server-side
    party_size              SMALLINT            NOT NULL,
    zone_id                 UUID                                 REFERENCES public.zones(id) ON DELETE SET NULL,
    slot_time               TIMESTAMPTZ         NOT NULL,                                       -- the reserved start time
    duration_minutes        SMALLINT            NOT NULL,                                       -- snapshot from restaurant settings at booking time
    status                  booking_status      NOT NULL DEFAULT 'confirmed',
    guest_note              TEXT,                                                                -- ≤ 200 chars, sanitised
    -- Payment linkage
    deposit_intent_id       UUID,                                                                -- FK added after payment_intents table created
    deposit_amount_cents    INTEGER,                                                             -- snapshot of total deposit; per_person × party_size
    deposit_currency        TEXT                NOT NULL DEFAULT 'EUR',
    -- Magic-link management
    magic_link_token_hash   TEXT                NOT NULL UNIQUE,                                -- SHA-256 of the manage-booking token
    -- Cancellation
    cancelled_at            TIMESTAMPTZ,
    cancelled_by            TEXT,                                                                -- 'guest' | 'restaurant' | 'system'
    cancellation_reason     TEXT,
    refund_intent_id        UUID,                                                                -- separate from deposit if partial refund logic (Phase 3+)
    -- Idempotency tracking (collected for forensic audit, not for the dedupe itself — that's at the API layer)
    idempotency_key         TEXT,
    -- Audit timestamps
    created_at              TIMESTAMPTZ         NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ         NOT NULL DEFAULT now(),

    CONSTRAINT bookings_party_size_check       CHECK (party_size >= 1 AND party_size <= 50),
    CONSTRAINT bookings_duration_check         CHECK (duration_minutes >= 15 AND duration_minutes <= 480),
    CONSTRAINT bookings_deposit_amount_check   CHECK (deposit_amount_cents IS NULL OR deposit_amount_cents >= 0),
    CONSTRAINT bookings_cancelled_consistent   CHECK (
        (status = 'cancelled' AND cancelled_at IS NOT NULL AND cancelled_by IS NOT NULL) OR
        (status <> 'cancelled')
    )
);

CREATE INDEX IF NOT EXISTS bookings_restaurant_slot_idx
    ON public.bookings (restaurant_id, slot_time)
    WHERE status IN ('pending', 'confirmed');                                                   -- partial index — availability queries only care about active bookings

CREATE INDEX IF NOT EXISTS bookings_guest_idx         ON public.bookings (guest_id);
CREATE INDEX IF NOT EXISTS bookings_restaurant_status_idx
    ON public.bookings (restaurant_id, status, slot_time DESC);
CREATE INDEX IF NOT EXISTS bookings_created_at_idx    ON public.bookings (created_at DESC);

COMMENT ON TABLE public.bookings IS
    'Reservation rows. Single-table bookings link via booking_tables (one row); multi-table comes in Phase 4 without schema change.';


-- ---------------------------------------------------------------------------
-- 3.3 booking_tables
-- ---------------------------------------------------------------------------
-- M:N between bookings and restaurant_tables. Phase 2 always inserts exactly
-- one row per booking. Phase 4 group bookings can insert many.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.booking_tables (
    booking_id              UUID                NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
    table_id                UUID                NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
    created_at              TIMESTAMPTZ         NOT NULL DEFAULT now(),

    PRIMARY KEY (booking_id, table_id)
);

CREATE INDEX IF NOT EXISTS booking_tables_table_idx ON public.booking_tables (table_id);

COMMENT ON TABLE public.booking_tables IS
    'M:N booking <-> tables. Phase 2 always inserts one row; reserved for multi-table from day 1.';


-- ---------------------------------------------------------------------------
-- 3.4 tabs
-- ---------------------------------------------------------------------------
-- Open running bills per table per service shift. Used by pay-at-table QR
-- ordering. One table can have one open tab at a time; closing a tab requires
-- explicit settlement.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.tabs (
    id                      UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id           UUID                NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    table_id                UUID                NOT NULL REFERENCES public.restaurant_tables(id) ON DELETE CASCADE,
    opened_at               TIMESTAMPTZ         NOT NULL DEFAULT now(),
    closed_at               TIMESTAMPTZ,
    total_cents             INTEGER             NOT NULL DEFAULT 0,                              -- running total; updated as orders added
    currency                TEXT                NOT NULL DEFAULT 'EUR',
    status                  TEXT                NOT NULL DEFAULT 'open',                        -- 'open' | 'settled' | 'cancelled'
    settled_at              TIMESTAMPTZ,
    settled_payment_intent_id UUID,                                                              -- the final pay-now that closes the tab
    created_at              TIMESTAMPTZ         NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ         NOT NULL DEFAULT now(),

    CONSTRAINT tabs_status_check       CHECK (status IN ('open', 'settled', 'cancelled')),
    CONSTRAINT tabs_total_check        CHECK (total_cents >= 0),
    CONSTRAINT tabs_settled_consistent CHECK (
        (status = 'settled' AND settled_at IS NOT NULL) OR
        (status <> 'settled')
    )
);

-- Only one open tab per table at a time
CREATE UNIQUE INDEX IF NOT EXISTS tabs_table_open_unique
    ON public.tabs (table_id)
    WHERE status = 'open';

CREATE INDEX IF NOT EXISTS tabs_restaurant_idx ON public.tabs (restaurant_id, opened_at DESC);

COMMENT ON TABLE public.tabs IS
    'Open running bills for pay-at-table QR ordering. One open tab per table at a time, enforced by partial unique index.';


-- ---------------------------------------------------------------------------
-- 3.5 orders
-- ---------------------------------------------------------------------------
-- QR + takeaway orders. Distinguished by order_type. Linked to a tab if
-- pay-at-table, to a payment_intent if pay-now.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.orders (
    id                      UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id           UUID                NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    guest_id                UUID                                 REFERENCES public.guests(id) ON DELETE RESTRICT,   -- NULL for anonymous QR (no email/phone given)
    order_type              order_type          NOT NULL,
    status                  order_status        NOT NULL DEFAULT 'pending',
    order_ref               TEXT                NOT NULL UNIQUE,                                 -- format PU-XXX (takeaway) or QR-XXX (QR); generated server-side

    -- QR specifics
    table_id                UUID                                 REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
    tab_id                  UUID                                 REFERENCES public.tabs(id) ON DELETE SET NULL,

    -- Takeaway specifics
    pickup_time             TIMESTAMPTZ,                                                          -- required for takeaway, NULL for QR

    -- Payment linkage
    payment_intent_id       UUID,                                                                 -- FK added after payment_intents table
    payment_status          TEXT                NOT NULL DEFAULT 'pending',                       -- 'pending' | 'paid' | 'open_tab' | 'refunded'

    -- Totals (server-computed, never trust client)
    subtotal_cents          INTEGER             NOT NULL,
    vat_cents               INTEGER             NOT NULL DEFAULT 0,
    total_cents             INTEGER             NOT NULL,
    currency                TEXT                NOT NULL DEFAULT 'EUR',

    -- Guest interaction
    guest_note              TEXT,                                                                 -- sanitised plain text, ≤ 200 chars
    guest_company_name      TEXT,                                                                 -- optional, takeaway only (business pickup)
    ready_notified_at       TIMESTAMPTZ,                                                          -- ready notification firing — idempotent guard

    -- Magic link for guest status page
    magic_link_token_hash   TEXT                NOT NULL UNIQUE,                                 -- separate from booking tokens

    -- Idempotency tracking
    idempotency_key         TEXT,

    -- Refund linkage (Phase 3 partial refunds; Phase 2 supports full refund)
    refund_intent_id        UUID,

    created_at              TIMESTAMPTZ         NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ         NOT NULL DEFAULT now(),

    CONSTRAINT orders_qr_has_table       CHECK (order_type <> 'qr' OR table_id IS NOT NULL),
    CONSTRAINT orders_takeaway_has_pickup CHECK (order_type <> 'takeaway' OR pickup_time IS NOT NULL),
    CONSTRAINT orders_subtotal_check     CHECK (subtotal_cents >= 0),
    CONSTRAINT orders_total_check        CHECK (total_cents >= 0),
    CONSTRAINT orders_payment_status_check
        CHECK (payment_status IN ('pending', 'paid', 'open_tab', 'refunded'))
);

CREATE INDEX IF NOT EXISTS orders_restaurant_created_idx
    ON public.orders (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_restaurant_status_idx
    ON public.orders (restaurant_id, status);
CREATE INDEX IF NOT EXISTS orders_guest_idx           ON public.orders (guest_id);
CREATE INDEX IF NOT EXISTS orders_table_idx           ON public.orders (table_id);
CREATE INDEX IF NOT EXISTS orders_tab_idx             ON public.orders (tab_id);
CREATE INDEX IF NOT EXISTS orders_pickup_time_idx
    ON public.orders (pickup_time)
    WHERE order_type = 'takeaway' AND status IN ('confirmed', 'preparing', 'ready');

COMMENT ON TABLE public.orders IS
    'QR and takeaway orders. order_type discriminates; constraints enforce required fields per type.';


-- ---------------------------------------------------------------------------
-- 3.6 order_items
-- ---------------------------------------------------------------------------
-- Line items. Server snapshots the unit price at order time so later menu
-- price changes don't retroactively change the customer's bill.
--
-- Modifiers stored as JSONB to keep Phase 4 modifier picker forward-compat
-- (PRD §17.4). Phase 2 ignores this column in UI; data shape is final.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.order_items (
    id                      UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id                UUID                NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id            UUID,                                                                 -- FK added after menu_items confirmed in §3.10
    name_snapshot           TEXT                NOT NULL,                                         -- menu item name at time of order
    unit_price_cents        INTEGER             NOT NULL,                                         -- snapshot
    quantity                SMALLINT            NOT NULL,
    line_total_cents        INTEGER             NOT NULL,                                         -- unit_price * quantity; server-computed
    currency                TEXT                NOT NULL DEFAULT 'EUR',
    item_notes              TEXT,                                                                 -- "no onions" etc., sanitised
    modifiers               JSONB,                                                                -- reserved for Phase 4 (PRD §17.4)
    created_at              TIMESTAMPTZ         NOT NULL DEFAULT now(),

    CONSTRAINT order_items_qty_check         CHECK (quantity >= 1 AND quantity <= 100),
    CONSTRAINT order_items_price_check       CHECK (unit_price_cents >= 0),
    CONSTRAINT order_items_total_check       CHECK (line_total_cents >= 0)
);

CREATE INDEX IF NOT EXISTS order_items_order_idx ON public.order_items (order_id);

COMMENT ON TABLE public.order_items IS
    'Order line items with snapshot of name and price at order time. Modifiers JSONB reserved for Phase 4.';


-- ---------------------------------------------------------------------------
-- 3.7 payment_intents
-- ---------------------------------------------------------------------------
-- One row per payment attempt. Abstracts Mollie so a future provider switch
-- only requires a new adapter, not a schema change (PRD §2.7).
--
-- Status transitions are guarded by a CHECK constraint (PRD §13.3 monotonic):
-- once terminal (paid, failed, cancelled, refunded), status can only move to
-- 'partially_refunded' (from paid) or stay put. Enforcement happens at the
-- DB level via the CHECK constraint and at the application level via the
-- pattern in lib/payments/transitionStatus.ts.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.payment_intents (
    id                      UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id           UUID                NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    purpose                 payment_intent_purpose NOT NULL,
    amount_cents            INTEGER             NOT NULL,
    currency                TEXT                NOT NULL DEFAULT 'EUR',
    status                  payment_intent_status  NOT NULL DEFAULT 'pending',

    -- External provider linkage (Mollie now; abstracted for future providers)
    provider                TEXT                NOT NULL DEFAULT 'mollie',
    provider_payment_id     TEXT,                                                                -- Mollie payment ID (tr_xxx)
    provider_mandate_id     TEXT,                                                                -- Mollie mandate ID for subscriptions

    -- Idempotency
    idempotency_key         TEXT                UNIQUE,                                          -- client-generated UUID per submit attempt

    -- Refund linkage
    refunded_amount_cents   INTEGER             NOT NULL DEFAULT 0,
    refunded_at             TIMESTAMPTZ,

    -- Metadata for audit / debugging
    metadata                JSONB,                                                                -- payload at create, Mollie response snippets, etc.

    created_at              TIMESTAMPTZ         NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ         NOT NULL DEFAULT now(),
    paid_at                 TIMESTAMPTZ,
    failed_at               TIMESTAMPTZ,
    cancelled_at            TIMESTAMPTZ,

    CONSTRAINT payment_intents_amount_check       CHECK (amount_cents >= 0),
    CONSTRAINT payment_intents_refund_amount_check CHECK (refunded_amount_cents >= 0 AND refunded_amount_cents <= amount_cents),
    CONSTRAINT payment_intents_provider_check     CHECK (provider IN ('mollie'))                 -- expand as adapters are added
);

CREATE INDEX IF NOT EXISTS payment_intents_provider_payment_idx
    ON public.payment_intents (provider_payment_id)
    WHERE provider_payment_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payment_intents_restaurant_idx
    ON public.payment_intents (restaurant_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payment_intents_status_idx
    ON public.payment_intents (status);

COMMENT ON TABLE public.payment_intents IS
    'Single source of truth for all guest-facing payment attempts. Abstracts Mollie. Status is monotonic — terminal states cannot regress.';


-- Now that payment_intents exists, add the FKs from bookings and orders.
ALTER TABLE public.bookings
    DROP CONSTRAINT IF EXISTS bookings_deposit_intent_fkey,
    ADD CONSTRAINT bookings_deposit_intent_fkey
        FOREIGN KEY (deposit_intent_id) REFERENCES public.payment_intents(id) ON DELETE SET NULL;

ALTER TABLE public.bookings
    DROP CONSTRAINT IF EXISTS bookings_refund_intent_fkey,
    ADD CONSTRAINT bookings_refund_intent_fkey
        FOREIGN KEY (refund_intent_id) REFERENCES public.payment_intents(id) ON DELETE SET NULL;

ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_payment_intent_fkey,
    ADD CONSTRAINT orders_payment_intent_fkey
        FOREIGN KEY (payment_intent_id) REFERENCES public.payment_intents(id) ON DELETE SET NULL;

ALTER TABLE public.orders
    DROP CONSTRAINT IF EXISTS orders_refund_intent_fkey,
    ADD CONSTRAINT orders_refund_intent_fkey
        FOREIGN KEY (refund_intent_id) REFERENCES public.payment_intents(id) ON DELETE SET NULL;

ALTER TABLE public.tabs
    DROP CONSTRAINT IF EXISTS tabs_settled_payment_intent_fkey,
    ADD CONSTRAINT tabs_settled_payment_intent_fkey
        FOREIGN KEY (settled_payment_intent_id) REFERENCES public.payment_intents(id) ON DELETE SET NULL;


-- ---------------------------------------------------------------------------
-- 3.8 magic_links
-- ---------------------------------------------------------------------------
-- Short-lived tokens for guest-facing actions (manage booking, view order,
-- cancel). Plain tokens are sent in URLs/emails; only SHA-256 hashes stored.
-- TTL and single-use semantics enforced in application code; this table
-- records the policy for audit.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.magic_links (
    id                      UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash              TEXT                NOT NULL UNIQUE,                                 -- SHA-256 hex of the plaintext token
    purpose                 magic_link_purpose  NOT NULL,
    booking_id              UUID                                 REFERENCES public.bookings(id) ON DELETE CASCADE,
    order_id                UUID                                 REFERENCES public.orders(id) ON DELETE CASCADE,
    expires_at              TIMESTAMPTZ         NOT NULL,
    consumed_at             TIMESTAMPTZ,                                                          -- single-use links set this on consume
    consume_count           INTEGER             NOT NULL DEFAULT 0,                              -- multi-use logged
    last_used_ip            INET,                                                                 -- audit only
    created_at              TIMESTAMPTZ         NOT NULL DEFAULT now(),

    CONSTRAINT magic_links_target_check CHECK (
        (booking_id IS NOT NULL AND order_id IS NULL) OR
        (booking_id IS NULL AND order_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS magic_links_expires_idx ON public.magic_links (expires_at);
CREATE INDEX IF NOT EXISTS magic_links_booking_idx ON public.magic_links (booking_id);
CREATE INDEX IF NOT EXISTS magic_links_order_idx   ON public.magic_links (order_id);

COMMENT ON TABLE public.magic_links IS
    'Short-lived tokens for guest actions. Token plaintext NEVER stored; only SHA-256 hash. TTL + single-use enforcement in application code.';


-- ---------------------------------------------------------------------------
-- 3.9 consumer_audit_logs
-- ---------------------------------------------------------------------------
-- Append-only audit trail for every booking / order / payment state change
-- and every magic-link consumption. Retained 7 years per GDPR retention
-- policy. No updates or deletes allowed (enforced via RLS — no UPDATE/DELETE
-- policy added).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.consumer_audit_logs (
    id                      UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id           UUID                NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    event_type              TEXT                NOT NULL,                                         -- e.g. 'booking.created', 'order.status_changed'
    event_data              JSONB               NOT NULL,                                         -- arbitrary payload describing what happened
    actor_type              TEXT                NOT NULL,                                         -- 'guest' | 'restaurant' | 'system' | 'platform'
    actor_id                UUID,                                                                 -- nullable; guest_id, user_id, or NULL for system
    booking_id              UUID                                 REFERENCES public.bookings(id) ON DELETE SET NULL,
    order_id                UUID                                 REFERENCES public.orders(id) ON DELETE SET NULL,
    payment_intent_id       UUID                                 REFERENCES public.payment_intents(id) ON DELETE SET NULL,
    ip_address              INET,
    user_agent              TEXT,
    created_at              TIMESTAMPTZ         NOT NULL DEFAULT now(),

    CONSTRAINT audit_actor_type_check CHECK (actor_type IN ('guest', 'restaurant', 'system', 'platform'))
);

CREATE INDEX IF NOT EXISTS audit_restaurant_created_idx
    ON public.consumer_audit_logs (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_event_type_idx
    ON public.consumer_audit_logs (event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_booking_idx
    ON public.consumer_audit_logs (booking_id);
CREATE INDEX IF NOT EXISTS audit_order_idx
    ON public.consumer_audit_logs (order_id);

COMMENT ON TABLE public.consumer_audit_logs IS
    'Append-only audit trail. RLS denies UPDATE/DELETE to everyone. 7-year retention per GDPR.';


-- ---------------------------------------------------------------------------
-- 3.10 menu tables (reconcile / create)
-- ---------------------------------------------------------------------------
-- The Phase 1 menu upload step probably created some structure already. This
-- block creates the canonical Phase 2 shape if missing, but does NOT clobber
-- existing tables. After this migration runs, an application-layer
-- reconciliation step (Build Plan C1.2) audits the result.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.menus (
    id                      UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id           UUID                NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name                    TEXT                NOT NULL,
    name_locale             TEXT                NOT NULL DEFAULT 'nl',
    published               BOOLEAN             NOT NULL DEFAULT FALSE,
    sort_order              SMALLINT            NOT NULL DEFAULT 0,
    created_at              TIMESTAMPTZ         NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ         NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS menus_restaurant_idx ON public.menus (restaurant_id, sort_order);
CREATE INDEX IF NOT EXISTS menus_restaurant_published_idx
    ON public.menus (restaurant_id) WHERE published = TRUE;


CREATE TABLE IF NOT EXISTS public.menu_categories (
    id                      UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_id                 UUID                NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
    name                    TEXT                NOT NULL,
    name_locale             TEXT                NOT NULL DEFAULT 'nl',
    description             TEXT,
    sort_order              SMALLINT            NOT NULL DEFAULT 0,
    published               BOOLEAN             NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ         NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ         NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS menu_categories_menu_idx ON public.menu_categories (menu_id, sort_order);


CREATE TABLE IF NOT EXISTS public.menu_items (
    id                      UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id             UUID                NOT NULL REFERENCES public.menu_categories(id) ON DELETE CASCADE,
    name                    TEXT                NOT NULL,
    name_locale             TEXT                NOT NULL DEFAULT 'nl',
    description             TEXT,
    price_cents             INTEGER             NOT NULL,
    currency                TEXT                NOT NULL DEFAULT 'EUR',
    vat_rate_bp             SMALLINT            NOT NULL DEFAULT 900,                            -- 9.00% — Dutch low VAT for food; stored as basis points to avoid float
    photo_url               TEXT,
    allergens               TEXT[]              NOT NULL DEFAULT '{}',                           -- ISO allergen codes
    contexts                TEXT[]              NOT NULL DEFAULT ARRAY['qr', 'takeaway'],        -- which consumer surfaces show this item
    available               BOOLEAN             NOT NULL DEFAULT TRUE,                           -- restaurant can toggle off without deleting (out of stock)
    sort_order              SMALLINT            NOT NULL DEFAULT 0,
    modifiers               JSONB,                                                                -- reserved for Phase 4 (PRD §17.4)
    published               BOOLEAN             NOT NULL DEFAULT TRUE,
    created_at              TIMESTAMPTZ         NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ         NOT NULL DEFAULT now(),

    CONSTRAINT menu_items_price_check     CHECK (price_cents >= 0),
    CONSTRAINT menu_items_vat_check       CHECK (vat_rate_bp >= 0 AND vat_rate_bp <= 10000),
    CONSTRAINT menu_items_contexts_check  CHECK (contexts <@ ARRAY['qr', 'takeaway'])
);

CREATE INDEX IF NOT EXISTS menu_items_category_idx ON public.menu_items (category_id, sort_order);
CREATE INDEX IF NOT EXISTS menu_items_published_idx
    ON public.menu_items (category_id)
    WHERE published = TRUE AND available = TRUE;

-- Now that menu_items exists, link order_items.menu_item_id
ALTER TABLE public.order_items
    DROP CONSTRAINT IF EXISTS order_items_menu_item_fkey,
    ADD CONSTRAINT order_items_menu_item_fkey
        FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id) ON DELETE SET NULL;

COMMENT ON TABLE public.menu_items IS
    'Menu items. price_cents and name are snapshotted into order_items at order time, so menu price changes do not retroactively alter past orders.';


-- ---------------------------------------------------------------------------
-- 3.11 menu_item_translations (Phase 4 forward-compat — PRD §17.1)
-- ---------------------------------------------------------------------------
-- Reserved but unused in Phase 2. Phase 4 adds translated rows here; consumer
-- pages JOIN on locale.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.menu_item_translations (
    menu_item_id            UUID                NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
    locale                  TEXT                NOT NULL,                                         -- 'nl' | 'en' | 'de' | 'fr' | ...
    name                    TEXT                NOT NULL,
    description             TEXT,
    created_at              TIMESTAMPTZ         NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ         NOT NULL DEFAULT now(),

    PRIMARY KEY (menu_item_id, locale)
);

COMMENT ON TABLE public.menu_item_translations IS
    'Reserved for Phase 4 multi-language menus (PRD §17.1). Phase 2 ignores this table.';


-- =============================================================================
-- 4. TRIGGERS — updated_at auto-update
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN
        SELECT unnest(ARRAY[
            'guests', 'bookings', 'orders', 'payment_intents',
            'tabs', 'menus', 'menu_categories', 'menu_items',
            'menu_item_translations'
        ])
    LOOP
        EXECUTE format(
            'DROP TRIGGER IF EXISTS %I_set_updated_at ON public.%I',
            tbl, tbl
        );
        EXECUTE format(
            'CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()',
            tbl, tbl
        );
    END LOOP;
END $$;


-- =============================================================================
-- 5. SECURITY DEFINER HELPER — magic-link lookup
-- =============================================================================
-- Anonymous clients (guests with a magic-link in their URL) need to read
-- their own booking or order without authentication. Direct RLS on bookings
-- would require giving anon read access broadly, which we refuse.
--
-- Solution: a SECURITY DEFINER function takes the plaintext token, hashes it,
-- checks the magic_links row (TTL, consumed_at, purpose), and returns the
-- linked booking/order data. The function runs as the table owner, bypasses
-- RLS, and is the only path through which anonymous reads happen.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.lookup_booking_by_magic_link(
    p_token TEXT
)
RETURNS TABLE (
    booking_id UUID,
    restaurant_id UUID,
    booking_ref TEXT,
    slot_time TIMESTAMPTZ,
    party_size SMALLINT,
    status booking_status,
    deposit_amount_cents INTEGER,
    deposit_currency TEXT,
    guest_full_name TEXT,
    guest_email TEXT,
    guest_phone TEXT,
    restaurant_display_name TEXT,
    restaurant_slug TEXT,
    cancellation_deadline TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token_hash TEXT;
    v_link RECORD;
BEGIN
    v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

    SELECT * INTO v_link
    FROM public.magic_links
    WHERE token_hash = v_token_hash
      AND purpose IN ('manage_booking', 'cancel_booking')
      AND expires_at > now()
      AND (purpose = 'manage_booking' OR consumed_at IS NULL);

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Increment consume_count for audit; consume single-use tokens
    UPDATE public.magic_links
       SET consume_count = consume_count + 1,
           consumed_at = CASE WHEN purpose = 'cancel_booking' THEN now() ELSE consumed_at END
     WHERE id = v_link.id;

    RETURN QUERY
    SELECT
        b.id,
        b.restaurant_id,
        b.booking_ref,
        b.slot_time,
        b.party_size,
        b.status,
        b.deposit_amount_cents,
        b.deposit_currency,
        g.full_name,
        g.email,
        g.phone,
        r.display_name,
        r.slug,
        -- Cancellation deadline: slot_time minus 24 hours by default; the
        -- application layer applies the actual restaurant-specific policy.
        b.slot_time - INTERVAL '24 hours' AS cancellation_deadline
    FROM public.bookings b
    JOIN public.guests g       ON g.id = b.guest_id
    JOIN public.restaurants r  ON r.id = b.restaurant_id
    WHERE b.id = v_link.booking_id;
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_booking_by_magic_link(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_booking_by_magic_link(TEXT) TO anon, authenticated;


-- Parallel function for orders (view-only).
CREATE OR REPLACE FUNCTION public.lookup_order_by_magic_link(
    p_token TEXT
)
RETURNS TABLE (
    order_id UUID,
    restaurant_id UUID,
    order_ref TEXT,
    order_type order_type,
    status order_status,
    pickup_time TIMESTAMPTZ,
    total_cents INTEGER,
    currency TEXT,
    table_label TEXT,
    restaurant_display_name TEXT,
    restaurant_slug TEXT,
    items JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_token_hash TEXT;
    v_link RECORD;
BEGIN
    v_token_hash := encode(digest(p_token, 'sha256'), 'hex');

    SELECT * INTO v_link
    FROM public.magic_links
    WHERE token_hash = v_token_hash
      AND purpose = 'view_order'
      AND expires_at > now();

    IF NOT FOUND THEN
        RETURN;
    END IF;

    UPDATE public.magic_links
       SET consume_count = consume_count + 1
     WHERE id = v_link.id;

    RETURN QUERY
    SELECT
        o.id,
        o.restaurant_id,
        o.order_ref,
        o.order_type,
        o.status,
        o.pickup_time,
        o.total_cents,
        o.currency,
        rt.label,
        r.display_name,
        r.slug,
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'name', oi.name_snapshot,
                'quantity', oi.quantity,
                'line_total_cents', oi.line_total_cents,
                'notes', oi.item_notes
            ) ORDER BY oi.created_at)
            FROM public.order_items oi
            WHERE oi.order_id = o.id
        ), '[]'::jsonb)
    FROM public.orders o
    LEFT JOIN public.restaurant_tables rt ON rt.id = o.table_id
    JOIN public.restaurants r ON r.id = o.restaurant_id
    WHERE o.id = v_link.order_id;
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_order_by_magic_link(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_order_by_magic_link(TEXT) TO anon, authenticated;


-- =============================================================================
-- 6. ROW-LEVEL SECURITY
-- =============================================================================
-- Defaults: RLS enabled on every consumer table. No public reads on PII or
-- transactional tables. Restaurant owners read their own data via auth.uid().
-- Anonymous reads of menu data are allowed where the restaurant is 'live' and
-- the row is published. Magic-link reads go through SECURITY DEFINER above.
-- All consumer writes are restricted to service-role (API routes only).
-- =============================================================================

-- 6.1 guests — RLS deny anon read; restaurant owners can SELECT only guests
-- linked to bookings/orders at their own restaurant.
ALTER TABLE public.guests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS guests_select_own_restaurant ON public.guests;
CREATE POLICY guests_select_own_restaurant ON public.guests
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.bookings b
            JOIN public.restaurants r ON r.id = b.restaurant_id
            WHERE b.guest_id = guests.id AND r.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM public.orders o
            JOIN public.restaurants r ON r.id = o.restaurant_id
            WHERE o.guest_id = guests.id AND r.user_id = auth.uid()
        )
    );

-- No INSERT/UPDATE/DELETE policies for non-service-role. Writes happen only
-- via API routes using the service role client.

-- 6.2 bookings
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bookings_select_own_restaurant ON public.bookings;
CREATE POLICY bookings_select_own_restaurant ON public.bookings
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = bookings.restaurant_id AND r.user_id = auth.uid()
        )
    );

-- 6.3 booking_tables
ALTER TABLE public.booking_tables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS booking_tables_select_own_restaurant ON public.booking_tables;
CREATE POLICY booking_tables_select_own_restaurant ON public.booking_tables
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.bookings b
            JOIN public.restaurants r ON r.id = b.restaurant_id
            WHERE b.id = booking_tables.booking_id AND r.user_id = auth.uid()
        )
    );

-- 6.4 orders
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orders_select_own_restaurant ON public.orders;
CREATE POLICY orders_select_own_restaurant ON public.orders
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = orders.restaurant_id AND r.user_id = auth.uid()
        )
    );

-- 6.5 order_items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS order_items_select_own_restaurant ON public.order_items;
CREATE POLICY order_items_select_own_restaurant ON public.order_items
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.orders o
            JOIN public.restaurants r ON r.id = o.restaurant_id
            WHERE o.id = order_items.order_id AND r.user_id = auth.uid()
        )
    );

-- 6.6 tabs
ALTER TABLE public.tabs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tabs_select_own_restaurant ON public.tabs;
CREATE POLICY tabs_select_own_restaurant ON public.tabs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = tabs.restaurant_id AND r.user_id = auth.uid()
        )
    );

-- 6.7 payment_intents — restaurant owner reads only
ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS payment_intents_select_own_restaurant ON public.payment_intents;
CREATE POLICY payment_intents_select_own_restaurant ON public.payment_intents
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = payment_intents.restaurant_id AND r.user_id = auth.uid()
        )
    );

-- 6.8 magic_links — NO anonymous or authenticated reads. Access only via
-- the SECURITY DEFINER functions in §5.
ALTER TABLE public.magic_links ENABLE ROW LEVEL SECURITY;

-- (No policy added on purpose — RLS denies all access by default.)

-- 6.9 consumer_audit_logs — restaurant owner reads only; nobody updates or deletes
ALTER TABLE public.consumer_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_select_own_restaurant ON public.consumer_audit_logs;
CREATE POLICY audit_select_own_restaurant ON public.consumer_audit_logs
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = consumer_audit_logs.restaurant_id AND r.user_id = auth.uid()
        )
    );

-- 6.10 menus — public read where restaurant is live and menu is published
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS menus_public_select ON public.menus;
CREATE POLICY menus_public_select ON public.menus
    FOR SELECT
    TO anon, authenticated
    USING (
        published = TRUE
        AND EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = menus.restaurant_id AND r.status = 'live'
        )
    );

DROP POLICY IF EXISTS menus_owner_select ON public.menus;
CREATE POLICY menus_owner_select ON public.menus
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.restaurants r
            WHERE r.id = menus.restaurant_id AND r.user_id = auth.uid()
        )
    );

-- 6.11 menu_categories — same pattern as menus
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS menu_categories_public_select ON public.menu_categories;
CREATE POLICY menu_categories_public_select ON public.menu_categories
    FOR SELECT
    TO anon, authenticated
    USING (
        published = TRUE
        AND EXISTS (
            SELECT 1 FROM public.menus m
            JOIN public.restaurants r ON r.id = m.restaurant_id
            WHERE m.id = menu_categories.menu_id
              AND m.published = TRUE
              AND r.status = 'live'
        )
    );

DROP POLICY IF EXISTS menu_categories_owner_select ON public.menu_categories;
CREATE POLICY menu_categories_owner_select ON public.menu_categories
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.menus m
            JOIN public.restaurants r ON r.id = m.restaurant_id
            WHERE m.id = menu_categories.menu_id AND r.user_id = auth.uid()
        )
    );

-- 6.12 menu_items — same pattern
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS menu_items_public_select ON public.menu_items;
CREATE POLICY menu_items_public_select ON public.menu_items
    FOR SELECT
    TO anon, authenticated
    USING (
        published = TRUE
        AND available = TRUE
        AND EXISTS (
            SELECT 1 FROM public.menu_categories c
            JOIN public.menus m       ON m.id = c.menu_id
            JOIN public.restaurants r ON r.id = m.restaurant_id
            WHERE c.id = menu_items.category_id
              AND c.published = TRUE
              AND m.published = TRUE
              AND r.status = 'live'
        )
    );

DROP POLICY IF EXISTS menu_items_owner_select ON public.menu_items;
CREATE POLICY menu_items_owner_select ON public.menu_items
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.menu_categories c
            JOIN public.menus m       ON m.id = c.menu_id
            JOIN public.restaurants r ON r.id = m.restaurant_id
            WHERE c.id = menu_items.category_id AND r.user_id = auth.uid()
        )
    );

-- 6.13 menu_item_translations — public read mirrors menu_items
ALTER TABLE public.menu_item_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS menu_translations_public_select ON public.menu_item_translations;
CREATE POLICY menu_translations_public_select ON public.menu_item_translations
    FOR SELECT
    TO anon, authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.menu_items mi
            WHERE mi.id = menu_item_translations.menu_item_id
              AND mi.published = TRUE
              AND mi.available = TRUE
        )
    );


-- =============================================================================
-- 7. GDPR HELPER — PII columns registry
-- =============================================================================
-- Single source of truth for which columns count as PII. Used by the data
-- export tool (Build Plan C8.3) and the soft-anonymisation routine.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.gdpr_pii_columns (
    table_name              TEXT                NOT NULL,
    column_name             TEXT                NOT NULL,
    category                TEXT                NOT NULL,                                         -- 'identifier' | 'contact' | 'free_text' | 'consent'
    anonymise_strategy      TEXT                NOT NULL,                                         -- 'overwrite_with_hash' | 'null' | 'placeholder'
    notes                   TEXT,

    PRIMARY KEY (table_name, column_name)
);

INSERT INTO public.gdpr_pii_columns (table_name, column_name, category, anonymise_strategy, notes) VALUES
    ('guests', 'full_name',            'identifier', 'placeholder',         'Replace with "Geanonimiseerd"'),
    ('guests', 'email',                'contact',    'overwrite_with_hash', 'sha256+anonymised@thetafel.nl'),
    ('guests', 'phone',                'contact',    'overwrite_with_hash', 'sha256-derived E.164 starting +99'),
    ('bookings', 'guest_note',         'free_text',  'null',                NULL),
    ('orders',   'guest_note',         'free_text',  'null',                NULL),
    ('orders',   'guest_company_name', 'free_text',  'null',                NULL),
    ('consumer_audit_logs', 'ip_address', 'identifier', 'null',             'Drop on anonymisation'),
    ('consumer_audit_logs', 'user_agent', 'identifier', 'null',             'Drop on anonymisation')
ON CONFLICT (table_name, column_name) DO NOTHING;

-- The PII registry itself is service-role read-only.
ALTER TABLE public.gdpr_pii_columns ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- 8. RESERVED FOR PHASE 5+ (PRD §17) — schema only, no UI yet
-- =============================================================================

-- 8.1 reviews — Phase 5 (PRD §17.10)
CREATE TABLE IF NOT EXISTS public.reviews (
    id                      UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id           UUID                NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
    booking_id              UUID                                 REFERENCES public.bookings(id) ON DELETE SET NULL,
    guest_id                UUID                                 REFERENCES public.guests(id) ON DELETE SET NULL,
    rating                  SMALLINT            NOT NULL,
    body                    TEXT,
    response                TEXT,                                                                 -- restaurant reply
    published               BOOLEAN             NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ         NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ         NOT NULL DEFAULT now(),

    CONSTRAINT reviews_rating_check CHECK (rating >= 1 AND rating <= 5)
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.reviews IS
    'Phase 5 reservation reviews. Schema present; UI not built in Phase 2.';

DROP TRIGGER IF EXISTS reviews_set_updated_at ON public.reviews;
CREATE TRIGGER reviews_set_updated_at
    BEFORE UPDATE ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- =============================================================================
-- COMMIT
-- =============================================================================

COMMIT;

-- =============================================================================
-- VERIFICATION QUERIES (run manually after migration; not part of the migration)
-- =============================================================================
-- The block below is intentionally commented. Build Plan C1.2 executes these
-- via Supabase MCP and reports any mismatches.
--
-- -- Tables created
-- SELECT table_name FROM information_schema.tables
--  WHERE table_schema = 'public'
--    AND table_name IN ('guests','bookings','booking_tables','orders','order_items',
--                       'tabs','payment_intents','magic_links','consumer_audit_logs',
--                       'menus','menu_categories','menu_items','menu_item_translations',
--                       'reviews','gdpr_pii_columns')
--  ORDER BY table_name;
--
-- -- RLS verification (every table should show rowsecurity = true)
-- SELECT relname, relrowsecurity FROM pg_class
--  WHERE relname IN ('guests','bookings','booking_tables','orders','order_items',
--                    'tabs','payment_intents','magic_links','consumer_audit_logs',
--                    'menus','menu_categories','menu_items','menu_item_translations',
--                    'reviews');
--
-- -- Anon access deny check (should return 0 rows for each)
-- SET ROLE anon;
-- SELECT count(*) FROM public.bookings;       -- expect: 0
-- SELECT count(*) FROM public.guests;         -- expect: 0
-- SELECT count(*) FROM public.payment_intents;-- expect: 0
-- RESET ROLE;
--
-- -- Anon public-menu read check
-- SET ROLE anon;
-- SELECT count(*) FROM public.menu_items;     -- expect: count of published+available items on live restaurants
-- RESET ROLE;
-- =============================================================================

-- END OF FILE
