import { getLocale, getTranslations } from 'next-intl/server'

/**
 * Thin footer for consumer pages.
 *
 * Shows the Tafel wordmark, a copyright line, and links to the privacy policy
 * and terms (Algemene Voorwaarden). The privacy page itself is built in C8.2;
 * for now we link to the marketing site's existing privacy page.
 */
export async function ConsumerShellFooter() {
  const locale = await getLocale()
  const t = await getTranslations('consumer.shell')

  const localePrefix = locale === 'en' ? '/en' : ''
  const year = new Date().getFullYear()

  return (
    <footer
      style={{
        width: '100%',
        backgroundColor: 'var(--warm, #f5efe4)',
        marginTop: 'auto',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '28px 20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          fontFamily: 'var(--font-jost), sans-serif',
          fontSize: '13px',
          color: 'var(--stone, #7a7264)',
        }}
      >
        <div>
          <span
            style={{
              fontFamily: 'var(--font-raleway), serif',
              fontWeight: 900,
              fontSize: '14px',
              letterSpacing: '-0.01em',
              color: 'var(--night, #0f0d08)',
              marginRight: '12px',
            }}
          >
            The Tafel
          </span>
          <span>© {year}</span>
        </div>
        <nav
          style={{
            display: 'flex',
            gap: '20px',
            fontWeight: 400,
          }}
          aria-label={t('footerNavAria')}
        >
          <a
            href={`${localePrefix}/privacybeleid`}
            style={{ color: 'var(--stone, #7a7264)', textDecoration: 'none' }}
          >
            {t('privacy')}
          </a>
          <a
            href={`${localePrefix}/algemene-voorwaarden`}
            style={{ color: 'var(--stone, #7a7264)', textDecoration: 'none' }}
          >
            {t('terms')}
          </a>
        </nav>
      </div>
    </footer>
  )
}
