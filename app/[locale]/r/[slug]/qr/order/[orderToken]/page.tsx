// app/[locale]/r/[slug]/qr/order/[orderToken]/page.tsx
//
// Q5 confirmation + live status page.
// Reads the order once via consumeOrderMagicLink (audited once, on page
// load), passes the initial status + order ref to the OrderStatus client
// component which polls the lean /status endpoint for updates per
// PRD §5 Q5's two-phase cadence.

import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import { consumeOrderMagicLink } from '@/lib/consumer/magicLinks'
import { OrderStatus } from '@/components/consumer/qr/OrderStatus'
import type { OrderStatus as OrderStatusValue } from '@/lib/orders/statusLabels'

export const dynamic = 'force-dynamic'

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/

const ALLOWED_STATUSES: OrderStatusValue[] = [
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'served',
  'completed',
  'cancelled',
  'refunded',
]

function coerceStatus(raw: string): OrderStatusValue {
  return ALLOWED_STATUSES.includes(raw as OrderStatusValue) ? (raw as OrderStatusValue) : 'pending'
}

interface PageProps {
  params: Promise<{ locale: string; slug: string; orderToken: string }>
}

export default async function QrOrderStatusPage({ params }: PageProps) {
  const { locale: rawLocale, slug, orderToken } = await params
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'

  if (!TOKEN_RE.test(orderToken)) notFound()

  const result = await consumeOrderMagicLink({ token: orderToken })
  if (!result.ok) notFound()

  const payload = result.payload
  const t = await getTranslations({ locale, namespace: 'consumer.qr.orderStatus' })

  const restaurantName = payload.restaurantDisplayName ?? 'Restaurant'
  const initialStatus = coerceStatus(payload.status)

  const money = (cents: number): string =>
    new Intl.NumberFormat(locale === 'en' ? 'en-NL' : 'nl-NL', {
      style: 'currency',
      currency: payload.currency || 'EUR',
    }).format(cents / 100)

  return (
    <>
      <div
        style={{
          background: '#f6ede0',
          padding: '16px 20px',
        }}
      >
        <div style={{ maxWidth: '480px', margin: '0 auto' }}>
          <p
            style={{
              fontFamily: 'var(--font-jost), sans-serif',
              fontWeight: 700,
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
              fontSize: '18px',
              color: 'var(--night, #0f0d08)',
              margin: '4px 0 0 0',
            }}
          >
            {restaurantName}
          </p>
          {payload.tableLabel ? (
            <p
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontWeight: 400,
                fontSize: '14px',
                color: 'var(--stone, #7a7264)',
                margin: '4px 0 0 0',
              }}
            >
              {t('tableLabel')} {payload.tableLabel}
            </p>
          ) : null}
        </div>
      </div>

      <section style={{ maxWidth: '480px', margin: '0 auto', padding: '32px 20px 80px' }}>
        <OrderStatus
          token={orderToken}
          locale={locale}
          initialStatus={initialStatus}
          initialOrderRef={payload.orderRef}
        />

        {payload.items.length > 0 ? (
          <div style={{ marginTop: '32px' }}>
            <h3
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontWeight: 700,
                fontSize: '11px',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'rgba(15, 13, 8, 0.6)',
                margin: 0,
              }}
            >
              {t('itemsHeading')}
            </h3>
            <ul style={{ listStyle: 'none', margin: '12px 0 0 0', padding: 0 }}>
              {payload.items.map((item, idx) => (
                <li
                  key={`${item.name}-${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '12px',
                    padding: '12px 0',
                    borderBottom: '1px solid rgba(30, 21, 8, 0.06)',
                  }}
                >
                  <div>
                    <p
                      style={{
                        fontFamily: 'var(--font-jost), sans-serif',
                        fontWeight: 600,
                        fontSize: '15px',
                        color: 'var(--night, #0f0d08)',
                        margin: 0,
                      }}
                    >
                      {item.quantity}
                      {t('quantityShort')} {item.name}
                    </p>
                    {item.notes ? (
                      <p
                        style={{
                          fontFamily: 'var(--font-jost), sans-serif',
                          fontWeight: 400,
                          fontStyle: 'italic',
                          fontSize: '13px',
                          color: 'var(--stone, #7a7264)',
                          margin: '2px 0 0 0',
                        }}
                      >
                        {item.notes}
                      </p>
                    ) : null}
                  </div>
                  <p
                    style={{
                      fontFamily: 'var(--font-jost), sans-serif',
                      fontWeight: 700,
                      fontSize: '14px',
                      color: 'var(--night, #0f0d08)',
                      whiteSpace: 'nowrap',
                      margin: 0,
                    }}
                  >
                    {money(item.line_total_cents)}
                  </p>
                </li>
              ))}
            </ul>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: '12px',
                paddingTop: '12px',
                borderTop: '1px solid rgba(30, 21, 8, 0.1)',
              }}
            >
              <p
                style={{
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontWeight: 700,
                  fontSize: '13px',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                  color: 'var(--night, #0f0d08)',
                  margin: 0,
                }}
              >
                {t('total')}
              </p>
              <p
                style={{
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontWeight: 700,
                  fontSize: '16px',
                  color: 'var(--night, #0f0d08)',
                  margin: 0,
                }}
              >
                {money(payload.totalCents)}
              </p>
            </div>
          </div>
        ) : null}

        <p
          style={{
            fontFamily: 'var(--font-jost), sans-serif',
            fontWeight: 400,
            fontSize: '13px',
            color: 'var(--stone, #7a7264)',
            textAlign: 'center',
            margin: '40px 0 0 0',
          }}
        >
          {t('help')}
        </p>

        <div style={{ marginTop: '16px', textAlign: 'center' }}>
          <Link
            href={`/r/${slug}`}
            style={{
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
      </section>
    </>
  )
}
