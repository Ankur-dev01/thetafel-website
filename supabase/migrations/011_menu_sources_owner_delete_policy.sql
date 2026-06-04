-- Allow restaurant owners to delete their own files from the
-- restaurant-menu-sources bucket via RLS-scoped storage.objects DELETE.
-- Mirror of the existing menu_sources_owner_read SELECT policy.
--
-- Applied to thetafel-prod via Supabase MCP on 2026-06-04 as part of D4.2.

create policy menu_sources_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'restaurant-menu-sources'
    and (storage.foldername(name))[1] in (
      select id::text from public.restaurants where user_id = auth.uid()
    )
  );
