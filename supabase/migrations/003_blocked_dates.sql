CREATE TABLE blocked_dates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  blocked_date   date NOT NULL,
  reason         text
);

ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner access blocked_dates"
  ON blocked_dates FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

CREATE POLICY "Public read blocked_dates"
  ON blocked_dates FOR SELECT
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE status = 'active'));
