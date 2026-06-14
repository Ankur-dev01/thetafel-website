import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n.ts')

const nextConfig: NextConfig = {
  images: {
    formats: ['image/webp'],
  },
  outputFileTracingIncludes: {
    '/api/v1/restaurants/qr/generate': ['./lib/qr/fonts/**'],
  },
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 180,
    },
  },
}

export default withNextIntl(nextConfig)