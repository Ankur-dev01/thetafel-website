-- 012_mollie_oauth_tokens.sql
-- Adds OAuth token columns to restaurants for Mollie Connect.
-- Additive, all nullable. No backfill. No RLS changes — existing
-- owner-only policies already cover these columns at row level.
--
-- SECURITY NOTE (v1 acceptable, must change before launch):
-- Tokens are stored in plaintext. RLS is the only thing preventing
-- cross-restaurant token access. Before the public launch (Phase D9),
-- migrate to pgsodium-encrypted columns or a dedicated secret store.
-- Tracking item: D9 security review checklist.

begin;

alter table public.restaurants
  add column mollie_access_token       text,
  add column mollie_refresh_token      text,
  add column mollie_token_expires_at   timestamptz;

comment on column public.restaurants.mollie_access_token is
  'OAuth access token from Mollie Connect. Short-lived (~1 hour).';
comment on column public.restaurants.mollie_refresh_token is
  'OAuth refresh token from Mollie Connect. Long-lived. Used to mint new access tokens.';
comment on column public.restaurants.mollie_token_expires_at is
  'Expiry timestamp of mollie_access_token in UTC. Refresh before this passes.';

commit;
