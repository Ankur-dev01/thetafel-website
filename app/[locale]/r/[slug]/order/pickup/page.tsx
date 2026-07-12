// app/[locale]/r/[slug]/order/pickup/page.tsx
//
// C6.1 PLACEHOLDER. C6.2 replaces this file with the real T3 pickup-time picker.

import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { resolveRestaurantBySlug } from '@/lib/consumer/resolveRestaurant'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ locale: string; slug: string }>
}

export default async function TakeawayPickupPlaceholderPage({ params }: PageProps) {
  const { locale: rawLocale, slug } = await params
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'
  const restaurant = await resolveRestaurantBySlug(slug)
  if (!restaurant) notFound()

  const t = await getTranslations({ locale, namespace: 'consumer.takeaway.pickupPlaceholder' })

  return (
    <main
      style={{
        backgroundColor: 'var(--cream, #fdfaf5)',
        minHeight: '100vh',
        padding: '48px 24px',
      }}
    >
      <div style={{ maxWidth: '560px', margin: '0 auto', textAlign: 'center' }}>
        <h1
          style={{
            fontFamily: 'var(--font-raleway), serif',
            fontWeight: 900,
            fontSize: 'clamp(28px, 6vw, 36px)',
            color: 'var(--night, #0f0d08)',
            margin: 0,
          }}
        >
          {t('heading')}
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-jost), sans-serif',
            fontWeight: 400,
            fontSize: '16px',
            color: 'var(--stone, #7a7264)',
            margin: '16px 0 0',
          }}
        >
          {t('body')}
        </p>
        <Link
          href={`/r/${slug}/order`}
          className="tafel-tap"
          style={{
            display: 'inline-block',
            marginTop: '32px',
            fontFamily: 'var(--font-jost), sans-serif',
            fontWeight: 500,
            fontSize: '14px',
            color: '#a86205',
            textDecoration: 'underline',
          }}
        >
          {t('backToMenu')}
        </Link>
      </div>
    </main>
  )
}
