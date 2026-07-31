-- Loosen guest contact fields to support walk-ins that don't hand over both.
-- Online bookings continue to supply both; no consumer code changes.

ALTER TABLE public.guests ALTER COLUMN email DROP NOT NULL;
ALTER TABLE public.guests ALTER COLUMN phone DROP NOT NULL;

-- full_name stays NOT NULL — every guest, walk-in or online, has a name.

-- Existing unique index `guests_email_phone_unique` on (email_lower, phone) WHERE anonymised_at IS NULL
-- stays as-is. Postgres treats NULLs as distinct in unique indexes by default, so multiple
-- walk-in rows with NULL email don't collide. Dedup for walk-ins is handled application-side
-- in `findExistingGuestByPhoneAtRestaurant` (restaurant-scoped by design).
