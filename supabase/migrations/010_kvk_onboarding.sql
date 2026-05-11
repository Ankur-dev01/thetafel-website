-- 010_kvk_onboarding.sql
--
-- Phase C.2 (Onboarding Step 1 — KVK number lookup + autofill).
--
-- Three blocks:
--   1. Add 11 new nullable columns sourced from the Dutch Chamber of
--      Commerce (KVK) Basisprofiel API, plus a unique index on
--      kvk_number.
--   2. Rename three existing columns to match the Phase 1 PRD §4 schema
--      naming conventions (PRD is source of truth; existing names
--      came from Phase A/B scaffolding before the PRD was locked).
--   3. Replace trial_ends_at (single timestamp) with trial_start_date
--      and trial_end_date (separate dates), backfilling from existing
--      data so no row loses its trial information.
--
-- Wrapped in a single transaction — any failure rolls back the whole
-- migration so the table is never left half-migrated.
--
-- Idempotent additions (ADD COLUMN IF NOT EXISTS, INDEX IF NOT EXISTS)
-- so a partial re-run doesn't error. Renames are not idempotent;
-- they'll only ever run once.

BEGIN;

-- =========================================================================
-- Block 1 — Add KVK columns
-- =========================================================================
-- All nullable for backwards compatibility with any restaurants rows that
-- already exist from Phase B testing. C.2 Step 1 populates these on first
-- KVK lookup.

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS kvk_number text,
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS legal_form text,
  ADD COLUMN IF NOT EXISTS legal_address_street text,
  ADD COLUMN IF NOT EXISTS legal_address_house_number text,
  ADD COLUMN IF NOT EXISTS legal_address_house_letter text,
  ADD COLUMN IF NOT EXISTS legal_address_house_number_addition text,
  ADD COLUMN IF NOT EXISTS legal_address_postcode text,
  ADD COLUMN IF NOT EXISTS legal_address_city text,
  ADD COLUMN IF NOT EXISTS sbi_code text;

-- Unique index on kvk_number — one KVK can only be onboarded once on
-- The Tafel. Because kvk_number is nullable, Postgres allows many NULLs
-- without violating UNIQUE, so existing rows without a KVK number don't
-- conflict with this constraint.

CREATE UNIQUE INDEX IF NOT EXISTS restaurants_kvk_number_unique_idx
  ON public.restaurants (kvk_number)
  WHERE kvk_number IS NOT NULL;

-- =========================================================================
-- Block 2 — Rename existing columns to match PRD §4 naming
-- =========================================================================
-- Only the columns Phase C will actually write to are renamed. The
-- existing extra columns (description, email, website, min_notice_hours,
-- mollie_mandate_id, listing_rank, discount_percentage) are left alone —
-- they were added thoughtfully and the PRD is silent on them, not
-- opposed to them.

ALTER TABLE public.restaurants
  RENAME COLUMN photo_url TO hero_image_url;

ALTER TABLE public.restaurants
  RENAME COLUMN phone TO contact_phone;

ALTER TABLE public.restaurants
  RENAME COLUMN slot_duration_minutes TO slot_interval_minutes;

-- =========================================================================
-- Block 3 — Split trial_ends_at into trial_start_date + trial_end_date
-- =========================================================================
-- PRD §4 specifies both columns as separate date types. The existing
-- schema only had trial_ends_at (timestamp). We:
--   (a) add the two new date columns,
--   (b) backfill any existing rows that have trial_ends_at populated,
--   (c) drop the old column.
--
-- Backfill logic (per team decision in Phase C kickoff):
--   trial_end_date   = trial_ends_at::date
--   trial_start_date = trial_ends_at::date - interval '30 days'

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS trial_start_date date,
  ADD COLUMN IF NOT EXISTS trial_end_date date;

UPDATE public.restaurants
   SET trial_end_date   = trial_ends_at::date,
       trial_start_date = (trial_ends_at::date) - INTERVAL '30 days'
 WHERE trial_ends_at IS NOT NULL
   AND trial_end_date IS NULL;

ALTER TABLE public.restaurants
  DROP COLUMN trial_ends_at;

COMMIT;

-- =========================================================================
-- Post-migration sanity checks (run these manually in the SQL Editor
-- after the migration completes — do NOT include in the transaction
-- above, these are verification queries):
--
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'restaurants'
--    ORDER BY ordinal_position;
--
--   SELECT indexname, indexdef
--     FROM pg_indexes
--    WHERE schemaname = 'public' AND tablename = 'restaurants';
-- =========================================================================
