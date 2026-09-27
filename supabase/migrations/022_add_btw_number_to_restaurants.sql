-- 022_add_btw_number_to_restaurants.sql
--
-- BTW-1: Add BTW (Dutch VAT) number capture to restaurants.
--
-- Required going forward for all new onboardings (enforced at
-- application layer, in the onboarding business step's completion
-- gate and in the PATCH zod schema's regex). Nullable in DB so
-- existing live restaurants — which were onboarded before this field
-- existed — survive the migration unchanged. A follow-up unit (BTW-2)
-- adds a dashboard settings surface for them to backfill.
--
-- Format: NL[9 digits]B[2 digits], e.g. NL123456789B01. Canonical
-- Dutch VAT-ID format — already verified live in this repo, since
-- OTS's own real BTW number (NL005440779B20) is hardcoded verbatim
-- into both contract templates' provider prose.
--
-- Stored uppercase; the CHECK constraint enforces that strictly
-- (case-sensitive). The application layer normalises input to
-- uppercase before insert/update, so this never rejects a
-- legitimately-entered number.

BEGIN;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS btw_number text;

ALTER TABLE public.restaurants
  ADD CONSTRAINT restaurants_btw_number_format_chk
  CHECK (btw_number IS NULL OR btw_number ~ '^NL[0-9]{9}B[0-9]{2}$');

-- One BTW number can only be onboarded once on The Tafel, mirroring
-- the existing restaurants_kvk_number_unique_idx. Because btw_number
-- is nullable, Postgres allows many NULLs without violating UNIQUE, so
-- existing rows without a BTW number don't conflict with this
-- constraint.
CREATE UNIQUE INDEX IF NOT EXISTS restaurants_btw_number_unique_idx
  ON public.restaurants (btw_number)
  WHERE btw_number IS NOT NULL;

COMMENT ON COLUMN public.restaurants.btw_number IS
  'Dutch VAT (BTW) number in canonical uppercase format NL[9]B[2]. '
  'Required at application layer for new onboardings; nullable in DB '
  'so pre-BTW-1 rows survive. Backfill surface is BTW-2.';

COMMIT;

-- =========================================================================
-- Post-migration sanity checks (run these manually in the SQL Editor
-- after the migration completes — do NOT include in the transaction
-- above, these are verification queries):
--
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'restaurants'
--      AND column_name = 'btw_number';
--
--   SELECT indexname, indexdef
--     FROM pg_indexes
--    WHERE schemaname = 'public' AND tablename = 'restaurants'
--      AND indexname = 'restaurants_btw_number_unique_idx';
--
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = 'public.restaurants'::regclass
--      AND conname = 'restaurants_btw_number_format_chk';
-- =========================================================================
