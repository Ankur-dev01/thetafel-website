import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n.ts')

const nextConfig: NextConfig = {
  images: {
    formats: ['image/webp'],
  },
  outputFileTracingIncludes: {
    '/api/v1/restaurants/qr/generate': ['./lib/qr/fonts/**'],
    '/api/consumer/privacy/data-request/verify': ['./lib/consumer/privacy/fonts/**'],
    '/api/consumer/privacy/data-deletion/verify': ['./lib/consumer/privacy/fonts/**'],
  },
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 180,
    },
  },
  async redirects() {
    return [
      { source: '/privacy/data-request', destination: '/privacybeleid/data-request', permanent: true },
      { source: '/privacy/data-request/verify', destination: '/privacybeleid/data-request/verify', permanent: true },
      { source: '/en/privacy/data-request', destination: '/en/privacybeleid/data-request', permanent: true },
      { source: '/en/privacy/data-request/verify', destination: '/en/privacybeleid/data-request/verify', permanent: true },
    ]
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
      // W3: the booking page is the one route meant to be embedded — in a
      // restaurant's own (third-party-origin) website via <iframe>, and in
      // this dashboard's own same-origin share-page preview. X-Frame-Options
      // has no "allow-listed origins" value, so we can't scope an exception
      // through it; CSP's frame-ancestors supersedes X-Frame-Options in
      // every modern browser (the spec requires CSP to win when both are
      // present), so adding it here neutralizes the DENY above for this
      // route without touching X-Frame-Options itself — every other route
      // keeps DENY completely unchanged, including as a fallback for the
      // handful of pre-CSP browsers on the booking page itself.
      {
        source: '/r/:slug/book',
        headers: [{ key: 'Content-Security-Policy', value: 'frame-ancestors *' }],
      },
      {
        source: '/en/r/:slug/book',
        headers: [{ key: 'Content-Security-Policy', value: 'frame-ancestors *' }],
      },
    ]
  },
}

export default withNextIntl(nextConfig)