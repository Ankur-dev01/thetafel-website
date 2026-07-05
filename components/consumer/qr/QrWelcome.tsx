import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/routing'
import type { PublicRestaurant } from '@/lib/consumer/resolveRestaurant'
import type { QrTable } from '@/lib/qr/resolveTable'

type QrWelcomeProps =
  | { mode: 'welcome'; restaurant: PublicRestaurant; table: QrTable }
  | { mode: 'unknown_table'; restaurant: null; table: null }

export async function QrWelcome(props: QrWelcomeProps) {
  return (
    <section
      style={{
        maxWidth: '560px',
        margin: '0 auto',
        padding: '48px 24px 80px',
        textAlign: 'center',
      }}
    >
      {props.mode === 'welcome' ? (
        <WelcomeContent restaurant={props.restaurant} table={props.table} />
      ) : (
        <UnknownTableContent />
      )}
    </section>
  )
}

async function WelcomeContent({
  restaurant,
  table,
}: {
  restaurant: PublicRestaurant
  table: QrTable
}) {
  const t = await getTranslations('consumer.qr.welcome')
  const name =
    restaurant.display_name || restaurant.legal_name || restaurant.slug

  return (
    <>
      <p
        style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 600,
          fontSize: '12px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--amber, #d4820a)',
          margin: 0,
        }}
      >
        {t('eyebrow', { label: table.label })}
      </p>
      <h1
        style={{
          fontFamily: 'var(--font-raleway), serif',
          fontWeight: 900,
          fontSize: 'clamp(32px, 6vw, 40px)',
          lineHeight: 1.1,
          color: 'var(--night, #0f0d08)',
          margin: '8px 0 0 0',
        }}
      >
        {name}
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 400,
          fontSize: '16px',
          lineHeight: 1.55,
          color: 'var(--stone, #7a7264)',
          margin: '16px 0 0 0',
        }}
      >
        {t('tagline')}
      </p>
      <Link
        href={`/r/${restaurant.slug}/qr/${table.qr_token}/menu`}
        style={{
          display: 'block',
          width: '100%',
          backgroundColor: 'var(--amber, #d4820a)',
          color: '#fff',
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 600,
          fontSize: '16px',
          padding: '16px 24px',
          borderRadius: '12px',
          marginTop: '32px',
          textDecoration: 'none',
        }}
      >
        {t('cta')}
      </Link>
      <p
        style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 400,
          fontSize: '13px',
          color: 'var(--stone, #7a7264)',
          margin: '24px 0 0 0',
          opacity: 0.75,
        }}
      >
        {t('footerNote')}
      </p>
    </>
  )
}

async function UnknownTableContent() {
  const t = await getTranslations('consumer.qr.unknownTable')

  return (
    <>
      <p
        style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 600,
          fontSize: '12px',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--amber, #d4820a)',
          margin: 0,
        }}
      >
        {t('eyebrow')}
      </p>
      <h1
        style={{
          fontFamily: 'var(--font-raleway), serif',
          fontWeight: 900,
          fontSize: 'clamp(28px, 6vw, 36px)',
          lineHeight: 1.1,
          color: 'var(--night, #0f0d08)',
          margin: '8px 0 0 0',
        }}
      >
        {t('heading')}
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 400,
          fontSize: '16px',
          lineHeight: 1.55,
          color: 'var(--stone, #7a7264)',
          margin: '16px 0 0 0',
        }}
      >
        {t('body')}
      </p>
    </>
  )
}
