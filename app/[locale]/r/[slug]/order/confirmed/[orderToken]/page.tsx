// app/[locale]/r/[slug]/order/confirmed/[orderToken]/page.tsx
//
// T6 takeaway confirmation + live status page (C6.4). Reads the order via
// consumeOrderMagicLink (audited once, on page load — same as the QR
// confirmation page from C5.6), renders order code, pickup time, items,
// total, and a live status card that polls for updates.

import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { consumeOrderMagicLink } from '@/lib/consumer/magicLinks'
import { OrderStatus } from '@/components/consumer/takeaway/OrderStatus'
import type { OrderStatus as OrderStatusValue } from '@/lib/orders/statusLabels'

export const dynamic = 'force-dynamic'

const TZ = 'Europe/Amsterdam'
const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/
const ALLOWED: OrderStatusValue[] = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'served',
  'completed',
  'cancelled',
  'refunded',
]

interface PageProps {
  params: Promise<{ locale: string; slug: string; orderToken: string }>
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

function money(cents: number, currency: string, locale: 'nl' | 'en'): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-NL' : 'nl-NL', {
    style: 'currency',
    currency: currency || 'EUR',
  }).format(cents / 100)
}

export default async function TakeawayConfirmedPage({ params }: PageProps) {
  const { locale: rawLocale, slug, orderToken } = await params
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'
  if (!TOKEN_RE.test(orderToken)) notFound()

  const result = await consumeOrderMagicLink({ token: orderToken })
  if (!result.ok) notFound()
  const payload = result.payload
  const status: OrderStatusValue = ALLOWED.includes(payload.status as OrderStatusValue)
    ? (payload.status as OrderStatusValue)
    : 'pending'

  const t = await getTranslations({ locale, namespace: 'consumer.takeaway.confirmed' })
  const restaurantName = payload.restaurantDisplayName ?? 'Restaurant'
  const pickup = payload.pickupTime ? formatWhen(payload.pickupTime, locale) : null

  return (
    <main style={{ backgroundColor: 'var(--cream, #fdfaf5)', minHeight: '100vh' }}>
      <header style={{ backgroundColor: '#f6ede0', padding: '20px 24px' }}>
        <div style={{ maxWidth: '560px', margin: '0 auto' }}>
          <p
            style={{
              fontFamily: 'var(--font-jost), sans-serif',
              fontWeight: 600,
              fontSize: '11px',
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#a86205',
              margin: 0,
            }}
          >
            {t('atRestaurant')}
          </p>
          <p
            style={{
              fontFamily: 'var(--font-raleway), serif',
              fontWeight: 900,
              fontSize: '20px',
              color: 'var(--night, #0f0d08)',
              margin: '4px 0 0',
            }}
          >
            {restaurantName}
          </p>
          {pickup ? (
            <p
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontWeight: 500,
                fontSize: '14px',
                color: 'var(--stone, #7a7264)',
                margin: '4px 0 0',
              }}
            >
              {t('pickupLabel')} {pickup}
            </p>
          ) : null}
        </div>
      </header>

      <div style={{ maxWidth: '560px', margin: '0 auto', padding: '24px 20px' }}>
        <OrderStatus
          token={orderToken}
          locale={locale}
          initialStatus={status}
          initialOrderRef={payload.orderRef}
        />

        {payload.items && payload.items.length > 0 ? (
          <section style={{ marginTop: '32px' }}>
            <h3
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontWeight: 600,
                fontSize: '11px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'var(--stone, #7a7264)',
                margin: '0 0 12px',
              }}
            >
              {t('itemsHeading')}
            </h3>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {payload.items.map((item, idx) => (
                <li
                  key={`${item.name}-${idx}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    padding: '12px 0',
                    borderBottom: '1px solid rgba(15,13,8,0.06)',
                  }}
                >
                  <div>
                    <p
                      style={{
                        fontFamily: 'var(--font-jost), sans-serif',
                        fontWeight: 500,
                        fontSize: '15px',
                        color: 'var(--night, #0f0d08)',
                        margin: 0,
                      }}
                    >
                      {item.quantity}× {item.name}
                    </p>
                    {item.notes ? (
                      <p
                        style={{
                          fontFamily: 'var(--font-jost), sans-serif',
                          fontWeight: 400,
                          fontSize: '13px',
                          color: 'var(--stone, #7a7264)',
                          margin: '2px 0 0',
                        }}
                      >
                        {item.notes}
                      </p>
                    ) : null}
                  </div>
                  <p
                    style={{
                      fontFamily: 'var(--font-jost), sans-serif',
                      fontWeight: 500,
                      fontSize: '14px',
                      color: 'var(--night, #0f0d08)',
                      margin: 0,
                    }}
                  >
                    {money(item.line_total_cents, payload.currency, locale)}
                  </p>
                </li>
              ))}
            </ul>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                padding: '16px 0 0',
                fontFamily: 'var(--font-jost), sans-serif',
                fontWeight: 600,
                fontSize: '15px',
                color: 'var(--night, #0f0d08)',
              }}
            >
              <span>{t('total')}</span>
              <span>{money(payload.totalCents, payload.currency, locale)}</span>
            </div>
          </section>
        ) : null}

        <p
          style={{
            marginTop: '32px',
            textAlign: 'center',
            fontFamily: 'var(--font-jost), sans-serif',
            fontWeight: 400,
            fontSize: '13px',
            color: 'var(--stone, #7a7264)',
          }}
        >
          {t('help')}
        </p>

        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <Link
            href={`/r/${slug}`}
            className="tafel-tap"
            style={{
              display: 'inline-block',
              fontFamily: 'var(--font-jost), sans-serif',
              fontWeight: 500,
              fontSize: '14px',
              color: '#a86205',
              textDecoration: 'underline',
            }}
          >
            {t('backToRestaurant')}
          </Link>
        </div>
      </div>
    </main>
  )
}
