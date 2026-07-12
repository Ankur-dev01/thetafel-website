// app/[locale]/r/[slug]/order/details/page.tsx
//
// C6.2 PLACEHOLDER. C6.3 replaces this file with the real T4 guest-details
// form + T5 Mollie kickoff. For now: bare landing so tapping Continue on the
// pickup-time picker doesn't 404. Echoes the chosen pickup instant.

import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { resolveRestaurantBySlug } from '@/lib/consumer/resolveRestaurant'

export const dynamic = 'force-dynamic'

const TZ = 'Europe/Amsterdam'

interface PageProps {
  params: Promise<{ locale: string; slug: string }>
  searchParams: Promise<{ pickup?: string }>
}

function formatWhen(iso: string, locale: 'nl' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', {
    timeZone: TZ,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

export default async function TakeawayDetailsPlaceholder({ params, searchParams }: PageProps) {
  const { locale: rawLocale, slug } = await params
  const { pickup } = await searchParams
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'
  const restaurant = await resolveRestaurantBySlug(slug)
  if (!restaurant) notFound()

  const t = await getTranslations({ locale, namespace: 'consumer.takeaway.detailsPlaceholder' })
  const whenLabel = pickup && !Number.isNaN(new Date(pickup).getTime()) ? formatWhen(pickup, locale) : null

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
        {whenLabel ? (
          <p
            style={{
              fontFamily: 'var(--font-jost), sans-serif',
              fontWeight: 500,
              fontSize: '16px',
              color: '#a86205',
              margin: '16px 0 0',
            }}
          >
            {t('pickupLine', { when: whenLabel })}
          </p>
        ) : null}
        <p
          style={{
            fontFamily: 'var(--font-jost), sans-serif',
            fontWeight: 400,
            fontSize: '15px',
            color: 'var(--stone, #7a7264)',
            margin: '16px 0 0',
          }}
        >
          {t('body')}
        </p>
        <Link
          href={`/r/${slug}/order/pickup`}
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
          {t('back')}
        </Link>
      </div>
    </main>
  )
}
