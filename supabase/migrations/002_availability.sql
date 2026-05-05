CREATE TABLE availability (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id  uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  day_of_week    int2 NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  open_time      time NOT NULL,
  close_time     time NOT NULL,
  is_active      bool DEFAULT true
);

ALTER TABLE availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner access availability"
  ON availability FOR ALL
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()))
  WITH CHECK (restaurant_id IN (SELECT id FROM restaurants WHERE user_id = auth.uid()));

CREATE POLICY "Public read availability"
  ON availability FOR SELECT
  USING (restaurant_id IN (SELECT id FROM restaurants WHERE status = 'active'));
