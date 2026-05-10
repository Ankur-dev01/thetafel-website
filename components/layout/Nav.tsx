'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { useModal } from '@/components/ui/ModalContext'

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const t = useTranslations('nav')
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const { openModal } = useModal()

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 60)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  const switchLocale = () => {
    const nextLocale = locale === 'nl' ? 'en' : 'nl'
    if (nextLocale === 'nl') {
      const newPath = pathname.replace(/^\/en/, '') || '/'
      router.push(newPath)
    } else {
      const newPath = '/en' + (pathname === '/' ? '' : pathname)
      router.push(newPath)
    }
  }

  const navLinks = [
    { label: t('howItWorks'), href: '#how-it-works' },
    { label: t('forRestaurants'), href: '#solution' },
    { label: t('pricing'), href: '#proof' },
  ]

  const loginHref = locale === 'nl' ? '/login' : '/en/login'

  return (
    <>
      <nav
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 200,
          height: '68px',
          display: 'flex',
          alignItems: 'center',
          backgroundColor: scrolled ? 'rgba(253,250,245,0.94)' : 'transparent',
          backdropFilter: scrolled ? 'blur(20px)' : 'none',
          borderBottom: scrolled ? '1px solid rgba(156,139,106,0.18)' : 'none',
          boxShadow: scrolled ? '0 4px 24px rgba(30,21,8,0.06)' : 'none',
          transition: 'all 0.4s ease',
        }}
      >
        <div
          className="nav-inner"
          style={{
            maxWidth: '1200px',
            margin: '0 auto',
            padding: '0 64px',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Link
            href={locale === 'nl' ? '/' : '/en'}
            style={{ textDecoration: 'none', lineHeight: 1 }}
          >
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
                fontFamily: 'var(--font-raleway)',
                fontSize: '22px',
                fontWeight: 900,
                letterSpacing: '-0.03em',
                lineHeight: 1,
                color: scrolled ? 'var(--earth)' : 'var(--cream)',
                transition: 'color 0.4s ease',
              }}
            >
              TAFEL
            </div>
          </Link>

          <div
            style={{ display: 'flex', alignItems: 'center', gap: '40px' }}
            className="desktop-nav"
          >
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                style={{
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontSize: '13px',
                  fontWeight: 400,
                  letterSpacing: '0.02em',
                  textDecoration: 'none',
                  color: scrolled ? 'var(--stone)' : 'rgba(253,250,245,0.7)',
                  transition: 'color 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = scrolled ? 'var(--earth)' : 'var(--cream)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = scrolled ? 'var(--stone)' : 'rgba(253,250,245,0.7)'
                }}
              >
                {link.label}
              </a>
            ))}
          </div>

          <div
            style={{ display: 'flex', alignItems: 'center', gap: '16px' }}
            className="desktop-nav"
          >
            <button
              onClick={switchLocale}
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '10px',
                fontWeight: 600,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '6px 12px',
                borderRadius: '100px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: 'var(--amber)',
                color: 'var(--cream)',
                transition: 'opacity 0.2s ease',
              }}
            >
              {locale === 'nl' ? 'EN' : 'NL'}
            </button>

            <Link
              href={loginHref}
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '13px',
                fontWeight: 400,
                letterSpacing: '0.02em',
                textDecoration: 'none',
                color: scrolled ? 'var(--stone)' : 'rgba(253,250,245,0.7)',
                transition: 'color 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = scrolled ? 'var(--earth)' : 'var(--cream)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = scrolled ? 'var(--stone)' : 'rgba(253,250,245,0.7)'
              }}
            >
              {t('restaurantLogin')}
            </Link>

            <button
              onClick={openModal}
              className="btn-primary"
              style={{ padding: '10px 24px', fontSize: '11px' }}
            >
              {t('startFree')}
            </button>
          </div>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="mobile-nav"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              display: 'none',
            }}
            aria-label="Menu"
          >
            <div
              style={{
                width: '22px',
                height: '2px',
                backgroundColor: scrolled ? 'var(--earth)' : 'var(--cream)',
                marginBottom: '5px',
                transition: 'background-color 0.4s ease',
              }}
            />
            <div
              style={{
                width: '22px',
                height: '2px',
                backgroundColor: scrolled ? 'var(--earth)' : 'var(--cream)',
                marginBottom: '5px',
                transition: 'background-color 0.4s ease',
              }}
            />
            <div
              style={{
                width: '22px',
                height: '2px',
                backgroundColor: scrolled ? 'var(--earth)' : 'var(--cream)',
                transition: 'background-color 0.4s ease',
              }}
            />
          </button>
        </div>
      </nav>

      {menuOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 199,
            backgroundColor: 'var(--cream)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '32px',
            animation: 'slideDown 0.25s ease',
          }}
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '18px',
                fontWeight: 400,
                letterSpacing: '0.02em',
                textDecoration: 'none',
                color: 'var(--stone)',
              }}
            >
              {link.label}
            </a>
          ))}
          <Link
            href={loginHref}
            onClick={() => setMenuOpen(false)}
            style={{
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: '18px',
              fontWeight: 400,
              letterSpacing: '0.02em',
              textDecoration: 'none',
              color: 'var(--stone)',
            }}
          >
            {t('restaurantLogin')}
          </Link>
          <button
            onClick={switchLocale}
            style={{
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              padding: '8px 16px',
              borderRadius: '100px',
              border: 'none',
              cursor: 'pointer',
              backgroundColor: 'var(--amber)',
              color: 'var(--cream)',
            }}
          >
            {locale === 'nl' ? 'EN' : 'NL'}
          </button>
          <button
            onClick={() => { setMenuOpen(false); openModal() }}
            className="btn-primary"
          >
            {t('startFree')}
          </button>
          <button
            onClick={() => setMenuOpen(false)}
            style={{
              position: 'absolute',
              top: '24px',
              right: '24px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '24px',
              color: 'var(--earth)',
              fontFamily: 'var(--font-jost), sans-serif',
            }}
            aria-label="Sluiten"
          >
            x
          </button>
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-nav { display: block !important; }
          .nav-inner { padding: 0 24px !important; }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </>
  )
}
