import { getLocale, getTranslations } from 'next-intl/server'

/**
 * Branded 404 page shown when:
 *   - the slug doesn't match any restaurant
 *   - the matching restaurant isn't live (RLS hides it, resolver returns null)
 *
 * Lives inside the layout shell, so the top bar and footer still render.
 */
export default async function ConsumerNotFound() {
  const locale = await getLocale()
  const t = await getTranslations('consumer.notFound')

  const homeHref = locale === 'en' ? '/en' : '/'

  return (
    <section
      style={{
        flex: '1 1 auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '80px 24px',
        maxWidth: '560px',
        margin: '0 auto',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 600,
          fontSize: '13px',
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
          fontSize: 'clamp(32px, 6vw, 56px)',
          lineHeight: 1.05,
          color: 'var(--night, #0f0d08)',
          margin: '14px 0 0 0',
        }}
      >
        {t('title')}
      </h1>
      <p
        style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 400,
          fontSize: '16px',
          lineHeight: 1.55,
          color: 'var(--stone, #7a7264)',
          marginTop: '20px',
        }}
      >
        {t('body')}
      </p>
      <a
        href={homeHref}
        style={{
          marginTop: '32px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '12px 22px',
          backgroundColor: 'var(--night, #0f0d08)',
          color: 'var(--cream, #fdfaf5)',
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 500,
          fontSize: '14px',
          letterSpacing: '0.02em',
          textDecoration: 'none',
          borderRadius: '999px',
        }}
      >
        {t('cta')}
      </a>
    </section>
  )
}
