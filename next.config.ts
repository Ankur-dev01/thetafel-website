import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n.ts')

const nextConfig: NextConfig = {
  images: {
    formats: ['image/webp'],
  },
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 180,
    },
  },
}

export default withNextIntl(nextConfig)