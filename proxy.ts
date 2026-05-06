import { NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { createServerClient } from '@supabase/ssr'

// next-intl routing config
const intlMiddleware = createMiddleware({
  locales: ['nl', 'en'],
  defaultLocale: 'nl',
  localePrefix: 'as-needed',
  // Disable auto-redirect based on Accept-Language/cookies so that:
  // - Dutch is always at / (regardless of browser language)
  // - English is always at /en
  // - Users switch manually via the language toggle
  localeDetection: false,
})

export async function proxy(request: NextRequest) {
  // Step 1: run next-intl. Returns either a redirect/rewrite or a passthrough response.
  const response = intlMiddleware(request)

  // Step 2: refresh the Supabase session by reading cookies from the request and writing
  // any updated cookies onto the response that next-intl produced. This keeps server
  // components and server actions in sync with the latest auth state.
  //
  // Note: API routes are excluded from this proxy entirely (see matcher below). They call
  // createSupabaseServerClient() directly and refresh their own session via cookies.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_PROD_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PROD_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            // Mirror onto the request so anything downstream in this same request sees it
            request.cookies.set(name, value)
            // And onto the response so the browser persists it
            response.cookies.set({ name, value, ...options })
          })
        },
      },
    }
  )

  // This call is what actually triggers a token refresh when the access token is near
  // expiry. Per Supabase docs, do NOT add logic between createServerClient and getUser —
  // it must run uninterrupted.
  await supabase.auth.getUser()

  return response
}

export const config = {
  // Run the proxy on every request EXCEPT:
  //  - api          → all API routes handle their own auth via createSupabaseServerClient.
  //                   Excluded from next-intl too (they are not localized).
  //  - _next        → Next.js internals (static, image, etc.)
  //  - _vercel      → Vercel internals
  //  - .*\\..*      → any file with an extension (.png, .jpg, .ico, favicon, etc.)
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}