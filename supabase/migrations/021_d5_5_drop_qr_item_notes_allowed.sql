-- D5.5: consolidate the duplicate qr_item_notes columns.
-- Part-2 (qr_item_notes_enabled) is canonical. Part-1 (qr_item_notes_allowed) is dropped.
-- Defensive sync in case a row diverges between now and apply time.
--
-- Confirmed via direct DB read before writing this migration: 5/5 live
-- restaurants had matching values on both columns (zero divergence). The
-- sync UPDATE below is belt-and-braces in case that changes before apply.
--
-- All code that used to write qr_item_notes_allowed (onboarding's qr-setup
-- step) has been refactored to write qr_item_notes_enabled instead — see
-- app/[locale]/onboarding/qr-setup/page.tsx and lib/onboarding/draftSchema.ts.

BEGIN;

-- If any row diverges, take the OR of both — least destructive interpretation.
UPDATE public.restaurants
SET qr_item_notes_enabled = (qr_item_notes_allowed OR qr_item_notes_enabled)
WHERE qr_item_notes_allowed IS DISTINCT FROM qr_item_notes_enabled;

-- Drop the Part-1 duplicate.
ALTER TABLE public.restaurants DROP COLUMN qr_item_notes_allowed;

COMMIT;
