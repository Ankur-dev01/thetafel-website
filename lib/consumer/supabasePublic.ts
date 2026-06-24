import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { cache } from 'react'

/**
 * Anonymous-only Supabase client for consumer-facing server code.
 *
 * Uses the public anon key. Reads NO cookies. Holds NO session. Crucially,
 * this means a server component using this client is not flagged as
 * "dynamic" by Next.js — the surrounding route can be statically rendered
 * with ISR (`export const revalidate = N`), and the result is cached.
 *
 * Use this client for:
 *   - resolving a restaurant by slug for a public page
 *   - reading published menu data for the QR or takeaway page
 *   - any other read that is identical for every viewer
 *
 * Do NOT use this client for:
 *   - authenticated reads (restaurant owner dashboard, onboarding)
 *   - any write
 *   - anything that depends on `auth.uid()` in an RLS policy
 *
 * For those cases keep using `createSupabaseServerClient` (cookies-aware) or
 * `createSupabaseServerClientAdmin` (service role).
 *
 * `cache()` wraps the factory so multiple resolvers in the same request
 * share a single client instance.
 */
export const createSupabasePublicClient = cache(() => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_PROD_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PROD_ANON_KEY

  if (!url) {
    throw new Error('NEXT_PUBLIC_SUPABASE_PROD_URL is not set')
  }
  if (!anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_PROD_ANON_KEY is not set')
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        // Tag outgoing requests so they're easy to spot in Supabase logs.
        'x-tafel-client': 'consumer-public',
      },
    },
  })
})
