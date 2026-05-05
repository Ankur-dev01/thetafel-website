CREATE UNIQUE INDEX idx_booking_slot
  ON bookings(restaurant_id, booking_date, booking_time)
  WHERE status != 'cancelled';

CREATE INDEX idx_bookings_restaurant_date
  ON bookings(restaurant_id, booking_date);

CREATE INDEX idx_bookings_reminder
  ON bookings(booking_date, reminder_sent)
  WHERE status = 'pending';

CREATE INDEX idx_restaurants_slug
  ON restaurants(slug);

CREATE INDEX idx_restaurants_status
  ON restaurants(status);

CREATE INDEX idx_availability_restaurant
  ON availability(restaurant_id, day_of_week);
