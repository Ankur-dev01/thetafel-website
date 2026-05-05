CREATE TABLE restaurants (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                  text NOT NULL,
  slug                  text NOT NULL UNIQUE,
  description           text,
  cuisine_type          text,
  address               text,
  postcode              text,
  city                  text,
  phone                 text,
  email                 text,
  website               text,
  photo_url             text,
  max_party_size        int4 DEFAULT 8,
  booking_lead_days     int4 DEFAULT 60,
  min_notice_hours      int4 DEFAULT 2,
  slot_duration_minutes int4 DEFAULT 90,
  status                text DEFAULT 'pending',
  listing_rank          int4 DEFAULT 0,
  discount_percentage   numeric,
  mollie_customer_id    text,
  mollie_mandate_id     text,
  trial_ends_at         timestamptz,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner access restaurants"
  ON restaurants FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Public read active restaurants"
  ON restaurants FOR SELECT
  USING (status = 'active');
