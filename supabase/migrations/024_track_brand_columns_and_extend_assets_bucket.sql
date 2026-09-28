-- Migration provenance fix. The five brand_* columns exist in prod
-- schema without a corresponding migration file. This migration is
-- idempotent — ADD COLUMN IF NOT EXISTS is a no-op if the column
-- already exists (which it does in prod). Purpose is to get the
-- columns tracked in version control so future schema audits and
-- fresh environments match prod.

ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS brand_primary_hex          text NULL,
  ADD COLUMN IF NOT EXISTS brand_secondary_hex        text NULL,
  ADD COLUMN IF NOT EXISTS brand_display_font_family  text NULL,
  ADD COLUMN IF NOT EXISTS brand_logo_url             text NULL,
  ADD COLUMN IF NOT EXISTS brand_menu_texture_url     text NULL;

COMMENT ON COLUMN public.restaurants.brand_primary_hex IS
  'Restaurant primary brand color (6-digit hex, e.g. #d4820a). Feeds resolveBrandTokens Phase 2 tier, wins over qr_widget_accent_color. Editable from /dashboard/settings/branding as of D5.7. Currently affects QR + takeaway surfaces only.';
COMMENT ON COLUMN public.restaurants.brand_logo_url IS
  'Public URL of the restaurant logo in the restaurant-assets bucket. Writable via POST /api/dashboard/branding/logo as of D5.7. Rendered on QR welcome header.';
COMMENT ON COLUMN public.restaurants.brand_secondary_hex IS
  'Dormant. Reserved for future secondary/accent color. Not editable in D5.7.';
COMMENT ON COLUMN public.restaurants.brand_display_font_family IS
  'Dormant. Not exposed for editing per Tafel brand rules (Raleway 900 + Jost platform-wide).';
COMMENT ON COLUMN public.restaurants.brand_menu_texture_url IS
  'Dormant. Reserved for future menu background texture. Not editable in D5.7.';

-- Extend restaurant-assets bucket to accept PNG. Logos commonly need
-- transparency, which JPEG doesn't support. SVG deliberately excluded
-- (can contain scripts — security concern).
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp']
WHERE id = 'restaurant-assets';
