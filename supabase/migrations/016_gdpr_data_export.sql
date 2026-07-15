-- C8.1 — GDPR data export: new magic_link_purpose values, guest/locale columns
-- on magic_links, a relaxed target check constraint, and a dropped FK on
-- consumer_audit_logs.restaurant_id so platform-level (non-restaurant-scoped)
-- privacy events can be audited with the null-UUID sentinel
-- (00000000-0000-0000-0000-000000000000).
--
-- IMPORTANT — apply in two steps. Postgres will not let a value just added to
-- an enum be referenced by a CHECK constraint in the *same* transaction. If
-- your SQL editor runs a whole pasted script as one transaction, run the
-- STEP 1 block first, wait for it to commit, then run STEP 2.

-- ============================================================================
-- STEP 1 — extend the enum (run first, then commit before continuing)
-- ============================================================================

alter type public.magic_link_purpose add value if not exists 'data_export';
alter type public.magic_link_purpose add value if not exists 'data_deletion';

-- ============================================================================
-- STEP 2 — columns, constraint, FK drop (run after STEP 1 has committed)
-- ============================================================================

alter table public.magic_links
  add column if not exists guest_id uuid references public.guests(id) on delete cascade,
  add column if not exists locale text;

comment on column public.magic_links.guest_id is
  'Guest this link identifies, for purposes with no single booking/order target (data_export, data_deletion). Null for booking/order-scoped links.';
comment on column public.magic_links.locale is
  'Locale (nl/en) the request was made in, so the eventual reply can match it. Only populated for privacy-scoped links.';

alter table public.magic_links
  drop constraint if exists magic_links_target_check;

alter table public.magic_links
  add constraint magic_links_target_check check (
    (purpose in ('manage_booking', 'cancel_booking') and booking_id is not null and order_id is null) or
    (purpose = 'view_order' and order_id is not null and booking_id is null) or
    (purpose in ('data_export', 'data_deletion') and booking_id is null and order_id is null)
  );

-- consumer_audit_logs.restaurant_id stays NOT NULL, but drops its FK so the
-- null-UUID sentinel can be written for platform-level privacy events with no
-- single owning restaurant. The auto-generated FK name is looked up rather
-- than hardcoded, in case it differs from the default naming convention.
do $$
declare
  fk_name text;
begin
  select con.conname into fk_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_attribute att on att.attrelid = con.conrelid and att.attnum = any(con.conkey)
  where rel.relname = 'consumer_audit_logs'
    and con.contype = 'f'
    and att.attname = 'restaurant_id';

  if fk_name is not null then
    execute format('alter table public.consumer_audit_logs drop constraint %I', fk_name);
  end if;
end $$;

comment on column public.consumer_audit_logs.restaurant_id is
  'NOT NULL, no longer FK-constrained. Platform-level events (not scoped to one restaurant, e.g. privacy.* ) use the sentinel 00000000-0000-0000-0000-000000000000.';
