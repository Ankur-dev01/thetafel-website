import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies, headers } from 'next/headers'

/**
 * User-scoped server client.
 * Reads the auth cookie and operates as the logged-in user.
 * RLS applies normally.
 *
 * Also accepts `Authorization: Bearer <access_token>` for callers that
 * cannot use cookies (native mobile). When a Bearer header is present it
 * wins over any cookie session: the token is forwarded to Supabase on every
 * outgoing request via `global.headers`, so both `auth.getUser()` and
 * RLS-scoped queries authorize as the token's user. The cookie adapter is
 * still attached so the returned client shape is identical for callers,
 * and `persistSession`/refresh are disabled to keep the Bearer branch
 * stateless (the mobile client refreshes its own token).
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  const headerStore = await headers()
  const authHeader = headerStore.get('authorization')
  const bearer =
    authHeader && /^Bearer\s+\S+/i.test(authHeader) ? authHeader : null

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_PROD_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PROD_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from a Server Component — safe to ignore
          }
        },
      },
      ...(bearer
        ? {
            global: { headers: { Authorization: bearer } },
            auth: {
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false,
            },
          }
        : {}),
    }
  )
}

/**
 * Service-role admin client.
 * Uses the service role key directly with no cookie/session wiring,
 * so RLS is bypassed. NEVER expose this client to the browser.
 * Only call from route handlers, server actions, or background jobs
 * where the operation is verified to be safe for the current user.
 *
 * The returned client carries no auth cookie. Authorize the caller
 * with the regular createSupabaseServerClient() first, then use this
 * client only for the privileged write (e.g. uploading to a bucket
 * with no owner-write policy).
 */
export async function createSupabaseServerClientAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_PROD_URL
  const serviceKey = process.env.SUPABASE_PROD_SERVICE_ROLE_KEY

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_PROD_URL is not set')
  }
  if (!serviceKey) {
    throw new Error('SUPABASE_PROD_SERVICE_ROLE_KEY is not set — admin client cannot bypass RLS')
  }
  if (serviceKey.length < 100) {
    throw new Error(
      `SUPABASE_PROD_SERVICE_ROLE_KEY looks too short (len=${serviceKey.length}) — is it the anon/publishable key by mistake?`,
    )
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
