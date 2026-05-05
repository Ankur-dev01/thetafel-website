CREATE TABLE subscriptions (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id            uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  mollie_subscription_id   text NOT NULL UNIQUE,
  mollie_customer_id       text NOT NULL,
  status                   text NOT NULL,
  amount_eur               numeric DEFAULT 69.00,
  next_charge_date         date NOT NULL,
  created_at               timestamptz DEFAULT now()
);

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner read subscriptions"
  ON subscriptions FOR SELECT
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));
