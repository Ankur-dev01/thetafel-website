-- =============================================================================
-- 018 — Dashboard schema wave 1 (D0.1)
-- Companion docs: TheTafel_Dashboard_Schema_v1.0.sql §1–§3
-- Owner-basis RLS (wave 1). Staff-membership RLS replaces these in D8.2.
-- All statements idempotent; live DB verified before authoring (2026-07-21).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Enums
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE staff_role AS ENUM ('owner','manager','service','kitchen');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE tab_settlement AS ENUM ('paid_at_table','written_off');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE booking_source AS ENUM ('online','walk_in','phone');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TYPE magic_link_purpose ADD VALUE IF NOT EXISTS 'staff_invite';

-- ---------------------------------------------------------------------------
-- 2) Tables
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.restaurant_staff (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role            staff_role NOT NULL,
  display_name    text NOT NULL,
  language        text NOT NULL DEFAULT 'nl' CHECK (language IN ('nl','en')),
  invited_by      uuid REFERENCES public.restaurant_staff(id),
  deactivated_at  timestamptz,
  last_active_at  timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, user_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS restaurant_staff_one_owner
  ON public.restaurant_staff (restaurant_id)
  WHERE role = 'owner' AND deactivated_at IS NULL;

CREATE INDEX IF NOT EXISTS restaurant_staff_by_user ON public.restaurant_staff (user_id);
CREATE INDEX IF NOT EXISTS restaurant_staff_by_restaurant ON public.restaurant_staff (restaurant_id);

CREATE TABLE IF NOT EXISTS public.staff_invites (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  email_lower     text NOT NULL,
  role            staff_role NOT NULL CHECK (role <> 'owner'),
  token_hash      text NOT NULL UNIQUE,
  invited_by      uuid NOT NULL REFERENCES public.restaurant_staff(id),
  expires_at      timestamptz NOT NULL,
  accepted_at     timestamptz,
  revoked_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, email_lower)
);
CREATE INDEX IF NOT EXISTS staff_invites_by_restaurant ON public.staff_invites (restaurant_id);

CREATE TABLE IF NOT EXISTS public.dashboard_audit_logs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     uuid NOT NULL,
  staff_id          uuid REFERENCES public.restaurant_staff(id),
  event_type        text NOT NULL,
  event_data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  booking_id        uuid,
  order_id          uuid,
  tab_id            uuid,
  payment_intent_id uuid,
  ip_address        inet,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS dash_audit_restaurant_time ON public.dashboard_audit_logs (restaurant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS dash_audit_booking ON public.dashboard_audit_logs (booking_id) WHERE booking_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS dash_audit_order   ON public.dashboard_audit_logs (order_id)   WHERE order_id   IS NOT NULL;
CREATE INDEX IF NOT EXISTS dash_audit_tab     ON public.dashboard_audit_logs (tab_id)     WHERE tab_id     IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.availability_exceptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  exception_date  date NOT NULL,
  closed          boolean NOT NULL DEFAULT true,
  open_time       time,
  close_time      time,
  service_scope   text NOT NULL DEFAULT 'all' CHECK (service_scope IN ('all','reservations','takeaway','qr')),
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, exception_date, service_scope),
  CHECK (closed = true OR (open_time IS NOT NULL AND close_time IS NOT NULL))
);
CREATE INDEX IF NOT EXISTS avail_exc_by_restaurant_date ON public.availability_exceptions (restaurant_id, exception_date);

CREATE TABLE IF NOT EXISTS public.guest_notes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id   uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  guest_id        uuid NOT NULL REFERENCES public.guests(id) ON DELETE CASCADE,
  note            text NOT NULL,
  updated_by      uuid REFERENCES public.restaurant_staff(id),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, guest_id)
);
CREATE INDEX IF NOT EXISTS guest_notes_by_guest ON public.guest_notes (guest_id);

-- ---------------------------------------------------------------------------
-- 3) Columns on existing tables
-- ---------------------------------------------------------------------------
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS paused_at timestamptz,
  ADD COLUMN IF NOT EXISTS paused_by uuid REFERENCES public.restaurant_staff(id),
  ADD COLUMN IF NOT EXISTS pause_reason text CHECK (pause_reason IS NULL OR pause_reason IN ('manual','billing_suspended')),
  ADD COLUMN IF NOT EXISTS grace_period_started_at timestamptz;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS source booking_source NOT NULL DEFAULT 'online',
  ADD COLUMN IF NOT EXISTS attended_at timestamptz,
  ADD COLUMN IF NOT EXISTS attended_marked_by uuid REFERENCES public.restaurant_staff(id);

ALTER TABLE public.tabs
  ADD COLUMN IF NOT EXISTS settlement tab_settlement,
  ADD COLUMN IF NOT EXISTS closed_by uuid REFERENCES public.restaurant_staff(id),
  ADD COLUMN IF NOT EXISTS write_off_reason text;

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS cancelled_by_staff uuid REFERENCES public.restaurant_staff(id);

ALTER TABLE public.menu_categories
  ADD COLUMN IF NOT EXISTS window_start time,
  ADD COLUMN IF NOT EXISTS window_end   time;

-- allergens is separate from the existing dietary_tags array: it holds the 14
-- EU-standard allergen keys only.
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS allergens text[] NOT NULL DEFAULT '{}'::text[];

-- ---------------------------------------------------------------------------
-- 4) updated_at triggers on new tables
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TRIGGER trg_restaurant_staff_updated_at BEFORE UPDATE ON public.restaurant_staff
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_availability_exceptions_updated_at BEFORE UPDATE ON public.availability_exceptions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_guest_notes_updated_at BEFORE UPDATE ON public.guest_notes
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 5) Owner backfill — one owner staff row per live restaurant.
-- profiles has no full_name column (verified 2026-07-21); restaurants.director_name
-- is the best available human name, falling back to 'Owner'.
-- ---------------------------------------------------------------------------
INSERT INTO public.restaurant_staff (restaurant_id, user_id, role, display_name, language)
SELECT
  r.id,
  r.user_id,
  'owner'::staff_role,
  COALESCE(NULLIF(r.director_name, ''), 'Owner'),
  COALESCE(NULLIF(p.locale, ''), 'nl')
FROM public.restaurants r
LEFT JOIN public.profiles p ON p.id = r.user_id
WHERE r.deleted_at IS NULL
ON CONFLICT (restaurant_id, user_id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 6) RLS wave 1 (owner-basis; replaced by staff-membership policies in D8.2)
-- ---------------------------------------------------------------------------
ALTER TABLE public.restaurant_staff        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_invites           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dashboard_audit_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_exceptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guest_notes             ENABLE ROW LEVEL SECURITY;

-- restaurant_staff: owner reads their restaurant's staff rows; anyone reads own row.
DROP POLICY IF EXISTS restaurant_staff_owner_select ON public.restaurant_staff;
CREATE POLICY restaurant_staff_owner_select ON public.restaurant_staff
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_staff.restaurant_id AND r.user_id = auth.uid()));

DROP POLICY IF EXISTS restaurant_staff_self_select ON public.restaurant_staff;
CREATE POLICY restaurant_staff_self_select ON public.restaurant_staff
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- staff_invites: owner reads; writes are service-role only.
DROP POLICY IF EXISTS staff_invites_owner_select ON public.staff_invites;
CREATE POLICY staff_invites_owner_select ON public.staff_invites
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = staff_invites.restaurant_id AND r.user_id = auth.uid()));

-- dashboard_audit_logs: owner reads; writes are service-role only.
DROP POLICY IF EXISTS dashboard_audit_owner_select ON public.dashboard_audit_logs;
CREATE POLICY dashboard_audit_owner_select ON public.dashboard_audit_logs
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = dashboard_audit_logs.restaurant_id AND r.user_id = auth.uid()));

-- availability_exceptions: owner full CRUD.
DROP POLICY IF EXISTS avail_exc_owner_select ON public.availability_exceptions;
CREATE POLICY avail_exc_owner_select ON public.availability_exceptions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = availability_exceptions.restaurant_id AND r.user_id = auth.uid()));

DROP POLICY IF EXISTS avail_exc_owner_insert ON public.availability_exceptions;
CREATE POLICY avail_exc_owner_insert ON public.availability_exceptions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = availability_exceptions.restaurant_id AND r.user_id = auth.uid()));

DROP POLICY IF EXISTS avail_exc_owner_update ON public.availability_exceptions;
CREATE POLICY avail_exc_owner_update ON public.availability_exceptions
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = availability_exceptions.restaurant_id AND r.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = availability_exceptions.restaurant_id AND r.user_id = auth.uid()));

DROP POLICY IF EXISTS avail_exc_owner_delete ON public.availability_exceptions;
CREATE POLICY avail_exc_owner_delete ON public.availability_exceptions
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = availability_exceptions.restaurant_id AND r.user_id = auth.uid()));

-- guest_notes: owner full CRUD, restaurant-scoped only. Never anon-readable.
DROP POLICY IF EXISTS guest_notes_owner_select ON public.guest_notes;
CREATE POLICY guest_notes_owner_select ON public.guest_notes
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = guest_notes.restaurant_id AND r.user_id = auth.uid()));

DROP POLICY IF EXISTS guest_notes_owner_insert ON public.guest_notes;
CREATE POLICY guest_notes_owner_insert ON public.guest_notes
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = guest_notes.restaurant_id AND r.user_id = auth.uid()));

DROP POLICY IF EXISTS guest_notes_owner_update ON public.guest_notes;
CREATE POLICY guest_notes_owner_update ON public.guest_notes
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = guest_notes.restaurant_id AND r.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = guest_notes.restaurant_id AND r.user_id = auth.uid()));

DROP POLICY IF EXISTS guest_notes_owner_delete ON public.guest_notes;
CREATE POLICY guest_notes_owner_delete ON public.guest_notes
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = guest_notes.restaurant_id AND r.user_id = auth.uid()));
