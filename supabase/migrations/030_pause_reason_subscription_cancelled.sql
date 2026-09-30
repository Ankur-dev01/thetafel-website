-- 030: allow pause_reason 'subscription_cancelled'. Applied via MCP 2026-10-01. Do not re-run.
ALTER TABLE public.restaurants DROP CONSTRAINT IF EXISTS restaurants_pause_reason_check;
ALTER TABLE public.restaurants ADD CONSTRAINT restaurants_pause_reason_check
  CHECK (pause_reason IS NULL OR pause_reason = ANY (ARRAY['manual'::text, 'billing_suspended'::text, 'subscription_cancelled'::text]));
