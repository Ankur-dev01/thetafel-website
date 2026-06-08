-- 013 — Snapshot VAT rate at time of charge on subscription and payment rows.
-- Rate is in basis points (2100 = 21%). Defaulting to 2100 covers any historical
-- rows that may have been created without an explicit rate (shouldn't exist in
-- production yet, but defensive).
--
-- Why snapshot: if NL changes the BTW rate in the future, historical records
-- must retain the rate they were charged at for accurate invoices and audits.

ALTER TABLE public.subscriptions
  ADD COLUMN vat_rate_bps INTEGER NOT NULL DEFAULT 2100;

ALTER TABLE public.payments
  ADD COLUMN vat_rate_bps INTEGER NOT NULL DEFAULT 2100;

COMMENT ON COLUMN public.subscriptions.vat_rate_bps IS
  'Dutch BTW rate in basis points at the time the subscription was set up. 2100 = 21%.';
COMMENT ON COLUMN public.payments.vat_rate_bps IS
  'Dutch BTW rate in basis points snapshotted at payment creation. 2100 = 21%.';
