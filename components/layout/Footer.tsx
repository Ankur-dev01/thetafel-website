'use client'

import Link from 'next/link'
import { useTranslations, useLocale } from 'next-intl'

export default function Footer() {
  const t = useTranslations('footer')
  const locale = useLocale()

  const base = locale === 'nl' ? '' : '/en'

  return (
    <footer
      style={{
        backgroundColor: '#080604',
        padding: '64px 0 0',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 64px',
        }}
        className="footer-container"
      >
        {/* Three Column Grid */}
        <div
          className="footer-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: '48px',
            paddingBottom: '48px',
            borderBottom: '1px solid rgba(156,139,106,0.12)',
          }}
        >
          {/* Left — Brand */}
          <div>
            <div style={{ marginBottom: '20px' }}>
              <div
                style={{
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontSize: '8px',
                  fontWeight: 700,
                  letterSpacing: '0.32em',
                  textTransform: 'uppercase',
                  color: 'var(--amber)',
                  marginBottom: '2px',
                }}
              >
                THE
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-raleway), sans-serif',
                  fontSize: '24px',
                  fontWeight: 900,
                  color: 'var(--cream)',
                  lineHeight: 1,
                }}
              >
                TAFEL
              </div>
            </div>
            <p
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '13px',
                fontWeight: 400,
                fontStyle: 'italic',
                color: 'var(--stone)',
                marginBottom: '24px',
              }}
            >
              {t('tagline')}
            </p>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '4px',
              }}
            >
              {[t('kvk'), t('btw'), t('city')].map((item, index) => (
                <span
                  key={index}
                  style={{
                    fontFamily: 'var(--font-jost), sans-serif',
                    fontSize: '12px',
                    fontWeight: 400,
                    color: 'rgba(156,139,106,0.6)',
                  }}
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          {/* Center — Platform Links */}
          <div>
            <div
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--amber)',
                marginBottom: '20px',
              }}
            >
              {t('col2Title')}
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              {[
                { label: t('link1'), href: '#how-it-works' },
                { label: t('link2'), href: '#solution' },
                { label: t('link3'), href: '#proof' },
                { label: t('link4'), href: '#final-cta' },
              ].map((link, index) => (
                <a
                  key={index}
                  href={link.href}
                  style={{
                    fontFamily: 'var(--font-jost), sans-serif',
                    fontSize: '14px',
                    fontWeight: 400,
                    color: 'var(--stone)',
                    textDecoration: 'none',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = 'var(--cream)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = 'var(--stone)'
                  }}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>

          {/* Right — Contact */}
          <div>
            <div
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '11px',
                fontWeight: 600,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color: 'var(--amber)',
                marginBottom: '20px',
              }}
            >
              {t('col3Title')}
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <a
                href="mailto:hallo@thetafel.nl"
                style={{
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontSize: '14px',
                  fontWeight: 400,
                  color: 'var(--stone)',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = 'var(--cream)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--stone)'
                }}
              >
                {t('email')}
              </a>
              <a
                href="https://wa.me/31634339839"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontSize: '14px',
                  fontWeight: 400,
                  color: 'var(--green)',
                  textDecoration: 'none',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = '0.8'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = '1'
                }}
              >
                {t('whatsapp')}
              </a>
              <Link
                href={`${base}/privacybeleid`}
                style={{
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontSize: '14px',
                  fontWeight: 400,
                  color: 'var(--stone)',
                  textDecoration: 'none',
                }}
              >
                {t('privacy')}
              </Link>
              <Link
                href={`${base}/algemene-voorwaarden`}
                style={{
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontSize: '14px',
                  fontWeight: 400,
                  color: 'var(--stone)',
                  textDecoration: 'none',
                }}
              >
                {t('terms')}
              </Link>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div
          className="footer-bottom"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '24px 0',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: '12px',
              fontWeight: 400,
              color: 'rgba(156,139,106,0.5)',
            }}
          >
            {t('copyright')}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: '12px',
              fontWeight: 400,
              color: 'rgba(156,139,106,0.5)',
            }}
          >
            {t('madeWith')}
          </span>
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .footer-container {
            padding: 0 24px !important;
          }
          .footer-grid {
            grid-template-columns: 1fr !important;
            gap: 40px !important;
          }
          .footer-bottom {
            flex-direction: column !important;
            gap: 8px !important;
            text-align: center !important;
          }
        }
      `}</style>
    </footer>
  )
}