CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1;

CREATE TABLE invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id     uuid NOT NULL REFERENCES restaurants(id),
  invoice_number    text NOT NULL UNIQUE,
  period_start      date NOT NULL,
  period_end        date NOT NULL,
  amount_ex_vat     numeric NOT NULL,
  vat_amount        numeric NOT NULL,
  amount_incl_vat   numeric NOT NULL,
  mollie_payment_id text NOT NULL,
  pdf_url           text,
  created_at        timestamptz DEFAULT now()
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner read invoices"
  ON invoices FOR SELECT
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));
