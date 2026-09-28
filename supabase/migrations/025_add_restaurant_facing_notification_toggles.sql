-- 025_add_restaurant_facing_notification_toggles.sql
--
-- D5.6b: per-restaurant on/off toggles for restaurant-facing emails
-- (new online booking, new paid takeaway order, guest cancellation).
-- Recipient is restaurants.contact_email. Distinct from the four
-- guest-facing notify_* columns added in 023.
--
-- Already applied to prod via Supabase MCP on 2026-09-29. This file keeps
-- the repo in sync; do not re-run.

BEGIN;

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS notify_restaurant_new_booking boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_restaurant_new_order boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_restaurant_booking_cancelled boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.restaurants.notify_restaurant_new_booking IS
  'D5.6b: email the restaurant (contact_email) when a guest books online. Default true. False = skip silently (email.skipped, reason restaurant_disabled).';
COMMENT ON COLUMN public.restaurants.notify_restaurant_new_order IS
  'D5.6b: email the restaurant (contact_email) when a takeaway order is paid. Default true. False = skip silently.';
COMMENT ON COLUMN public.restaurants.notify_restaurant_booking_cancelled IS
  'D5.6b: email the restaurant (contact_email) when a guest cancels their booking. Default true. False = skip silently.';

COMMIT;
