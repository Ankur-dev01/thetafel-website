-- 026_backfill_missing_owner_staff_rows.sql
--
-- STAFF-1: 018's owner backfill was one-time only. No app code created
-- restaurant_staff rows afterwards, so every restaurant created after
-- 2026-07-21 had no owner row and was 403'd by assertDashboardWriteAllowed
-- on every write. This backfills them. Going forward, the draft-creation
-- route and the write guard call ensureOwnerStaffRow().
--
-- Already applied to prod via Supabase MCP on 2026-09-29. Do not re-run.

INSERT INTO public.restaurant_staff (restaurant_id, user_id, role, display_name, language)
SELECT
  r.id,
  r.user_id,
  'owner'::staff_role,
  COALESCE(NULLIF(r.director_name, ''), NULLIF(u.email::text, ''), 'Owner'),
  CASE WHEN p.locale = 'en' THEN 'en' ELSE 'nl' END
FROM public.restaurants r
LEFT JOIN auth.users u ON u.id = r.user_id
LEFT JOIN public.profiles p ON p.id = r.user_id
WHERE r.deleted_at IS NULL
  AND r.user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.restaurant_staff s
    WHERE s.restaurant_id = r.id AND s.role = 'owner' AND s.deactivated_at IS NULL
  )
ON CONFLICT (restaurant_id, user_id) DO NOTHING;
