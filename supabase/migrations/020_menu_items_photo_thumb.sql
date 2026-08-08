-- D4.4 — menu item photo upload
--
-- Adds the thumbnail path alongside the existing `photo_path`. The card grid
-- renders the thumb (400x400 WebP) and only the detail panel loads the full
-- 1200px image, so a 60-item menu list stops pulling 60 full-size photos.
--
-- Nullable with no default: every existing row keeps a null thumb until its
-- photo is next uploaded or replaced, and both the consumer render
-- (lib/menu/fetchMenu.ts) and the dashboard queries select explicit column
-- lists, so nothing picks this up until D4.4's code does.

ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS photo_thumb_path text;
