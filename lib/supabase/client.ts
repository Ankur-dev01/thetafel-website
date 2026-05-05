import { createBrowserClient } from '@supabase/ssr'

export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_PROD_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PROD_ANON_KEY!
  )
}