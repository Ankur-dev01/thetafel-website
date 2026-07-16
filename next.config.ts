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
}

export default withNextIntl(nextConfig)