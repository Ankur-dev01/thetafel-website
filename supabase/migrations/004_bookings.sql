CREATE TABLE bookings (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id       uuid NOT NULL REFERENCES restaurants(id),
  booking_reference   text NOT NULL UNIQUE,
  guest_name          text NOT NULL,
  guest_email         text NOT NULL,
  guest_phone         text NOT NULL,
  booking_date        date NOT NULL,
  booking_time        time NOT NULL,
  party_size          int4 NOT NULL,
  status              text DEFAULT 'pending',
  reminder_sent       bool DEFAULT false,
  gdpr_consent        bool DEFAULT false,
  internal_notes      text,
  language            text DEFAULT 'nl',
  amount_paid         numeric DEFAULT 0,
  discount_applied    numeric DEFAULT 0,
  payment_status      text DEFAULT 'not_required',
  mollie_payment_id   text,
  order_type          text DEFAULT 'dine_in',
  created_at          timestamptz DEFAULT now()
);

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner read update bookings"
  ON bookings FOR SELECT
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

CREATE POLICY "Owner update bookings"
  ON bookings FOR UPDATE
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

CREATE POLICY "Anonymous insert bookings"
  ON bookings FOR INSERT
  WITH CHECK (
    gdpr_consent = true
    AND restaurant_id IN (SELECT id FROM restaurants WHERE status = 'active')
  );
