import createMiddleware from 'next-intl/middleware'

const handleProxy = createMiddleware({
  locales: ['nl', 'en'],
  defaultLocale: 'nl',
  localePrefix: 'as-needed',
  // Disable auto-redirect based on Accept-Language/cookies so that:
  // - Dutch is always at / (regardless of browser language)
  // - English is always at /en
  // - Users switch manually via the language toggle
  localeDetection: false,
})

export const proxy = handleProxy

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}