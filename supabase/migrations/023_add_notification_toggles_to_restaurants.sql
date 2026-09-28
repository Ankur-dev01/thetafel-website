-- 023_add_notification_toggles_to_restaurants.sql
--
-- D5.6a: per-restaurant on/off toggles for the four guest-facing
-- notification events currently wired: booking confirmation, booking
-- cancellation, takeaway order confirmed, takeaway order ready.
--
-- All default TRUE — existing behaviour preserved for every current row.
-- Dispatchers read these before firing; disabled = skip silently
-- (matching the existing "no guest email → skip" pattern already in
-- dispatchTakeawayReady.ts, which treats skip as success rather than
-- failure — no Today-page alert, no email.send_failed row).
--
-- Channel is implicit here (email — the only channel actually live in
-- prod today; WhatsApp is feature-flagged off globally, pending Meta
-- template approval — see D5.6 investigation). When WhatsApp goes live
-- per-restaurant (D5.6b+), either add companion `_whatsapp` columns or
-- migrate to a preferences table.

BEGIN;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS notify_booking_confirmed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_booking_cancelled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_order_confirmed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_order_ready boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.restaurants.notify_booking_confirmed IS
  'Send guest an email when their booking is confirmed. Default true. '
  'False = skip silently (still counts as success, no audit-log failure row).';
COMMENT ON COLUMN public.restaurants.notify_booking_cancelled IS
  'Send guest an email when their booking is cancelled. Default true. '
  'False = skip silently.';
COMMENT ON COLUMN public.restaurants.notify_order_confirmed IS
  'Send guest an email when their takeaway order payment succeeds. Default true. '
  'False = skip silently.';
COMMENT ON COLUMN public.restaurants.notify_order_ready IS
  'Send guest an email when staff marks their takeaway order ready. Default true. '
  'False = skip silently.';

COMMIT;

-- =========================================================================
-- Post-migration sanity checks (run manually in the SQL Editor after the
-- migration completes):
--
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'restaurants'
--      AND column_name LIKE 'notify_%'
--    ORDER BY column_name;
-- =========================================================================
