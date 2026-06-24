import { getLocale, getTranslations } from 'next-intl/server'
import { ConsumerLanguageToggle } from './ConsumerLanguageToggle'

/**
 * Thin top bar for every consumer page.
 *
 * Left: Tafel wordmark linking back to the marketing homepage.
 *       Set in Raleway 900 (the brand display face) at a small size so it
 *       reads as a mark rather than a headline.
 * Right: language toggle (NL / EN).
 *
 * Cream background. No border below — per the brand rule we separate sections
 * by background colour shifts only. The page content provides its own visual
 * weight after this bar.
 */
export async function ConsumerShellTopBar() {
  const locale = await getLocale()
  const t = await getTranslations('consumer.shell')

  const homeHref = locale === 'en' ? '/en' : '/'

  return (
    <header
      style={{
        width: '100%',
        backgroundColor: 'var(--cream, #fdfaf5)',
        position: 'sticky',
        top: 0,
        zIndex: 30,
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <a
          href={homeHref}
          aria-label={t('homeLinkAria')}
          style={{
            fontFamily: 'var(--font-raleway), serif',
            fontWeight: 900,
            fontSize: '20px',
            letterSpacing: '-0.01em',
            color: 'var(--night, #0f0d08)',
            textDecoration: 'none',
          }}
        >
          The Tafel
        </a>
        <ConsumerLanguageToggle />
      </div>
    </header>
  )
}
