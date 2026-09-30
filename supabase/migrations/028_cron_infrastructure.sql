-- 028_cron_infrastructure.sql
-- D5.6d: pg_cron + pg_net, and a service_role-only secret check used by
-- /api/cron/* routes. The secret itself lives in Supabase Vault under the
-- name 'cron_secret' and is intentionally NOT in this repo.
-- Already applied to prod via Supabase MCP on 2026-09-30. Do not re-run.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.verify_cron_secret(p_token text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'cron_secret' AND decrypted_secret = p_token
  );
$$;

REVOKE ALL ON FUNCTION public.verify_cron_secret(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_secret(text) TO service_role;
