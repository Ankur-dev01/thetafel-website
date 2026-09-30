-- 027_booking_reminder_tracking.sql
-- D5.6d: per-booking reminder claim timestamps. Already applied to prod via
-- Supabase MCP on 2026-09-30. Do not re-run.

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_2h_sent_at timestamptz;

COMMENT ON COLUMN public.bookings.reminder_24h_sent_at IS
  'D5.6d: set atomically (claim-before-send) when the 24h guest reminder email is dispatched. NULL = not sent.';
COMMENT ON COLUMN public.bookings.reminder_2h_sent_at IS
  'D5.6d: set atomically (claim-before-send) when the 2h guest reminder email is dispatched. NULL = not sent.';

CREATE INDEX IF NOT EXISTS bookings_reminder_scan_idx
  ON public.bookings (slot_time)
  WHERE status = 'confirmed' AND (reminder_24h_sent_at IS NULL OR reminder_2h_sent_at IS NULL);
