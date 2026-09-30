-- 029_invoice_numbers.sql
-- BATCH-3: sequential invoice numbers for paid charges.
-- Already applied to prod via Supabase MCP on 2026-10-01. Do not re-run.

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS invoice_number text;
CREATE UNIQUE INDEX IF NOT EXISTS payments_invoice_number_key ON public.payments (invoice_number) WHERE invoice_number IS NOT NULL;
CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1;

CREATE OR REPLACE FUNCTION public.assign_invoice_number(p_payment_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_existing text;
  v_paid_at timestamptz;
  v_number text;
BEGIN
  SELECT invoice_number, paid_at INTO v_existing, v_paid_at
    FROM public.payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'payment % not found', p_payment_id;
  END IF;
  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;
  v_number := 'TFL-' || to_char(COALESCE(v_paid_at, now()) AT TIME ZONE 'Europe/Amsterdam', 'YYYY') || '-'
              || lpad(nextval('public.invoice_number_seq')::text, 6, '0');
  UPDATE public.payments SET invoice_number = v_number, updated_at = now() WHERE id = p_payment_id;
  RETURN v_number;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_invoice_number(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assign_invoice_number(uuid) TO service_role;
REVOKE ALL ON SEQUENCE public.invoice_number_seq FROM PUBLIC, anon, authenticated;
