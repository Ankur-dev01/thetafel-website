import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

/**
 * User-scoped server client.
 * Reads the auth cookie and operates as the logged-in user.
 * RLS applies normally.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()

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
    throw new Error('SUPABASE_PROD_SERVICE_ROLE_KEY is not set')
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
