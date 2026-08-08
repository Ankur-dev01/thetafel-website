-- =============================================================================
-- The Tafel — Dashboard Schema v1.0
-- Document: TheTafel_Dashboard_Schema_v1.0.sql
-- Companion to: TheTafel_Dashboard_PRD_v1.0.md, TheTafel_Dashboard_BuildPlan_v1.0.md
--
-- IMPORTANT WORKING RULE (unchanged from Part 2): the live DB is the source of
-- truth over any file, including this one. Before applying any section, verify
-- current live shape via Supabase MCP (project ipjzrprddlsxjsiiozgh) and adapt.
-- This file states intent; the applying migration adapts to reality.
--
-- Apply order: §1 enums → §2 tables/columns → §3 RLS wave 1 (owner-basis)
-- during D0.1. §3 wave 2 (staff-membership basis) applies during D8.2.
-- §4 (functions) applies with the units that need them.
-- =============================================================================


-- =============================================================================
-- 1. ENUMS
-- =============================================================================

-- Staff roles (PRD §2.1)
DO $$ BEGIN
    CREATE TYPE staff_role AS ENUM ('owner', 'manager', 'service', 'kitchen');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Tab settlement (PRD §4.4)
DO $$ BEGIN
    CREATE TYPE tab_settlement AS ENUM ('paid_at_table', 'written_off');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Booking source (PRD §4.2 walk-ins; PRD §13.5 limit exclusion)
DO $$ BEGIN
    CREATE TYPE booking_source AS ENUM ('online', 'walk_in', 'phone');
    -- 'phone' reserved: staff-entered phone bookings behave like walk-ins with
    -- contact details. v1 UI exposes online (implicit) + walk_in only.
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- magic_link_purpose gains staff invite purposes (ALTER, not CREATE —
-- the enum exists from Part 2 and already gained data_export/data_deletion in C8.1)
-- ALTER TYPE magic_link_purpose ADD VALUE IF NOT EXISTS 'staff_invite';


-- =============================================================================
-- 2. TABLES AND COLUMNS
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 2.1 restaurant_staff — staff membership + role per restaurant (PRD §2)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.restaurant_staff (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   uuid NOT NULL REFERENCES public.restaurants(id),
    user_id         uuid NOT NULL REFERENCES auth.users(id),
    role            staff_role NOT NULL,
    display_name    text NOT NULL,              -- shown in audit trails and team list
    language        text NOT NULL DEFAULT 'nl' CHECK (language IN ('nl','en')),
    invited_by      uuid REFERENCES public.restaurant_staff(id),
    deactivated_at  timestamptz,                -- soft-deactivate; never delete (audit integrity)
    last_active_at  timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (restaurant_id, user_id)
);
-- Exactly one active owner row per restaurant, enforced partially:
CREATE UNIQUE INDEX IF NOT EXISTS restaurant_staff_one_owner
    ON public.restaurant_staff (restaurant_id)
    WHERE role = 'owner' AND deactivated_at IS NULL;
-- D0.1 backfills one owner row per existing restaurant from restaurants.user_id.

-- -----------------------------------------------------------------------------
-- 2.2 staff_invites — pending invitations (PRD §2.2)
-- Token pattern identical to magic_links: SHA-256 hash stored, plaintext only in URL.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.staff_invites (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   uuid NOT NULL REFERENCES public.restaurants(id),
    email_lower     text NOT NULL,
    role            staff_role NOT NULL CHECK (role <> 'owner'),  -- owners are never invited
    token_hash      text NOT NULL UNIQUE,
    invited_by      uuid NOT NULL REFERENCES public.restaurant_staff(id),
    expires_at      timestamptz NOT NULL,       -- now() + interval '7 days'
    accepted_at     timestamptz,
    revoked_at      timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (restaurant_id, email_lower)          -- one live invite per address per restaurant
);

-- -----------------------------------------------------------------------------
-- 2.3 dashboard_audit_logs — every mutating dashboard action (PRD §2.3)
-- Mirrors consumer_audit_logs shape; separate table keeps consumer-write RLS simple.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dashboard_audit_logs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   uuid NOT NULL,               -- no FK, matching the C8.1 consumer decision
    staff_id        uuid REFERENCES public.restaurant_staff(id),
    event_type      text NOT NULL,               -- e.g. 'booking.marked_attended', 'tab.closed', 'menu.item_86ed'
    event_data      jsonb NOT NULL DEFAULT '{}',
    booking_id      uuid,
    order_id        uuid,
    tab_id          uuid,
    payment_intent_id uuid,
    ip_address      inet,
    created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dash_audit_restaurant_time
    ON public.dashboard_audit_logs (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dash_audit_booking ON public.dashboard_audit_logs (booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS dash_audit_order   ON public.dashboard_audit_logs (order_id)   WHERE order_id   IS NOT NULL;

-- -----------------------------------------------------------------------------
-- 2.4 availability_exceptions — holiday closures / special hours (PRD §4.8.1)
-- Consumer availability checks consult this table AFTER the weekly availability rows.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.availability_exceptions (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   uuid NOT NULL REFERENCES public.restaurants(id),
    exception_date  date NOT NULL,
    closed          boolean NOT NULL DEFAULT true,   -- true = fully closed that date
    open_time       time,                            -- when closed=false: special hours
    close_time      time,
    service_scope   text NOT NULL DEFAULT 'all'
                    CHECK (service_scope IN ('all','reservations','takeaway','qr')),
    note            text,                            -- internal, shown in dashboard only
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (restaurant_id, exception_date, service_scope),
    CHECK (closed = true OR (open_time IS NOT NULL AND close_time IS NOT NULL))
);

-- -----------------------------------------------------------------------------
-- 2.5 guest_notes — restaurant-private notes about a guest (PRD §4.5)
-- Separate table (not a column on guests): notes are restaurant-scoped;
-- guests are global. Included in the guest's own GDPR export; anonymisation
-- of a guest cascades deletion here (function update in §4.2).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.guest_notes (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurant_id   uuid NOT NULL REFERENCES public.restaurants(id),
    guest_id        uuid NOT NULL REFERENCES public.guests(id),
    note            text NOT NULL,
    updated_by      uuid REFERENCES public.restaurant_staff(id),
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (restaurant_id, guest_id)                 -- one living note per pair; edits update in place
);

-- -----------------------------------------------------------------------------
-- 2.6 New columns on existing tables
-- (Names verified against live DB before applying; live wins on conflicts.)
-- -----------------------------------------------------------------------------

-- restaurants: pause + billing grace (PRD §5, §8.4)
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS paused_at timestamptz;
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS paused_by uuid REFERENCES public.restaurant_staff(id);
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS pause_reason text
    CHECK (pause_reason IS NULL OR pause_reason IN ('manual','billing_suspended'));
ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS grace_period_started_at timestamptz;

-- bookings: source + walk-in support (PRD §4.2, §13.5)
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS source booking_source NOT NULL DEFAULT 'online';
-- Note: guest_id stays NOT NULL in live schema; walk-ins reuse/create a minimal
-- guest row with a placeholder identity IF live constraints require it — the
-- D2.4 unit resolves this against the live constraint and documents the choice.
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS attended_at timestamptz;
ALTER TABLE public.bookings ADD COLUMN IF NOT EXISTS attended_marked_by uuid REFERENCES public.restaurant_staff(id);

-- tabs: settlement stamping (PRD §4.4)
ALTER TABLE public.tabs ADD COLUMN IF NOT EXISTS settlement tab_settlement;
ALTER TABLE public.tabs ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES public.restaurant_staff(id);
ALTER TABLE public.tabs ADD COLUMN IF NOT EXISTS write_off_reason text;

-- orders: cancellation attribution from dashboard
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS cancelled_by_staff uuid REFERENCES public.restaurant_staff(id);

-- menu_categories: availability windows (PRD §4.6)
ALTER TABLE public.menu_categories ADD COLUMN IF NOT EXISTS window_start time;
ALTER TABLE public.menu_categories ADD COLUMN IF NOT EXISTS window_end time;

-- menu_items: allergens (PRD §4.6) — 14 EU allergens as a text[] of stable keys
ALTER TABLE public.menu_items ADD COLUMN IF NOT EXISTS allergens text[] NOT NULL DEFAULT '{}';

-- -----------------------------------------------------------------------------
-- 2.7 dashboard_stats_daily — RESERVED, NOT CREATED IN V1 (PRD §4.7)
-- Materialised rollup for Insights if live-query cost demands it later.
-- Intentionally absent from v1 DDL; documented here so nobody reinvents it.
-- -----------------------------------------------------------------------------


-- =============================================================================
-- 3. RLS
-- =============================================================================
-- Every new table: RLS ON at creation. No exceptions (standing hard rule).
--
-- WAVE 1 (D0.1, owner-basis): policies grant SELECT/INSERT/UPDATE on dashboard
-- tables where restaurant_id resolves to a restaurant whose user_id = auth.uid().
-- Service-role bypasses RLS as ever for server routes.
--
-- WAVE 2 (D8.2, staff-membership basis): wave-1 policies are REPLACED by
-- membership policies of the canonical shape:
--
--   USING (EXISTS (
--     SELECT 1 FROM public.restaurant_staff s
--     WHERE s.restaurant_id = <table>.restaurant_id
--       AND s.user_id = auth.uid()
--       AND s.deactivated_at IS NULL
--   ))
--
-- Role-level differences (e.g. kitchen cannot read guests) are enforced in the
-- application permission map, not in RLS — RLS answers "is this person staff at
-- this restaurant," the permission map answers "may this role do this action."
-- Rationale: role logic in RLS breeds subtle policy drift; one enforcement
-- brain (lib/dashboard/permissions.ts) + membership-RLS as the hard backstop.
--
-- Existing consumer tables (bookings, orders, tabs, payment_intents, guests):
-- gain ADDITIVE staff-read policies in wave 2. Consumer-facing anon policies
-- from Part 2 are untouched. guest_notes and staff tables are never
-- anon-readable under any policy.

ALTER TABLE public.restaurant_staff       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_invites          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_audit_logs   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_notes            ENABLE ROW LEVEL SECURITY;

-- (Wave-1 concrete policies authored in the D0.1 migration against live shape.)


-- =============================================================================
-- 4. FUNCTIONS
-- =============================================================================

-- 4.1 Staff-invite acceptance runs in application code (server route), not a DB
-- function — it must call supabase.auth.admin APIs which SQL cannot.

-- 4.2 anonymise_guest UPDATE (D7.1): extend the existing SECURITY DEFINER
-- function to also DELETE FROM public.guest_notes WHERE guest_id = p_guest_id.
-- STANDING RULE applies: after CREATE OR REPLACE, immediately re-audit grants —
-- revoke PUBLIC/anon/authenticated, grant EXECUTE to service_role only.

-- 4.3 Starter booking-limit check (D2.4 / consumer create): counts
-- bookings WHERE source = 'online' AND slot month = current month — walk-ins
-- excluded by definition (PRD §13.5). Application-level helper, not a trigger.


-- =============================================================================
-- 5. RETENTION NOTES (feeds the retention-policy doc, LAUNCH_CHECKLIST §2)
-- =============================================================================
-- dashboard_audit_logs: retain 24 months, then archivable (no v1 automation).
-- staff_invites: expired/revoked rows deletable after 90 days (no v1 automation).
-- guest_notes: deleted on guest anonymisation (§4.2); otherwise live with guest.

-- =============================================================================
-- End of TheTafel_Dashboard_Schema_v1.0
-- =============================================================================
