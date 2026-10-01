'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Link as LocaleLink } from '@/i18n/routing'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'
import { useModal } from '@/components/ui/ModalContext'
import { TafelLogo } from '@/components/home/svgs'
import s from './Nav.module.css'

type Props = {
  /**
   * Pages without a dark hero at scroll position 0 (e.g. plain-cream content
   * pages like the privacy policy) must render the header solid from the
   * start — otherwise the white logo and nav links render invisible against
   * the cream page background until the user scrolls past the sticky-header
   * threshold.
   */
  solid?: boolean
}

const WHATSAPP_HREF = 'https://wa.me/31634339839'

export default function Nav({ solid = false }: Props) {
  const [scrolledState, setScrolled] = useState(false)
  const scrolled = solid || scrolledState
  const [menuOpen, setMenuOpen] = useState(false)
  const t = useTranslations('home.nav')
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
    { label: t('product'), hash: 'products' },
    { label: t('pricing'), hash: 'pricing' },
    { label: t('about'), hash: 'ownership' },
  ]

  const loginHref = locale === 'nl' ? '/login' : '/en/login'

  return (
    <>
      <header className={`${s.nav} ${scrolled ? s.scrolled : ''}`}>
        <div className={s.stage}>
          <div className={s.pill}>
            <Link href={locale === 'nl' ? '/' : '/en'} className={s.logo} aria-label={t('home')}>
              <TafelLogo className={s.logoSvg} />
              <span className={s.srOnly}>TAFEL</span>
            </Link>

            <nav className={s.links} aria-label="Primary">
              {navLinks.map((link) => (
                <LocaleLink key={link.hash} href={{ pathname: '/', hash: link.hash }} className={s.link}>
                  {link.label}
                </LocaleLink>
              ))}
              <Link href={loginHref} className={s.link}>
                {t('login')}
              </Link>
            </nav>

            <div className={s.actions}>
              <button type="button" onClick={switchLocale} className={s.locale}>
                {locale === 'nl' ? 'EN' : 'NL'}
              </button>

              <a
                href={WHATSAPP_HREF}
                target="_blank"
                rel="noopener noreferrer"
                className={`${s.btn} ${s.btnWhite} ${s.getInTouch}`}
              >
                {t('getInTouch')}
              </a>

              <button type="button" onClick={openModal} className={`${s.btn} ${s.btnBlack} ${s.bookCall}`}>
                {t('bookCall')}
              </button>
            </div>

            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className={s.burger}
              aria-label={t('menu')}
              aria-expanded={menuOpen}
            >
              <span />
              <span />
              <span />
            </button>
          </div>
        </div>
      </header>

      {menuOpen && (
        <div className={s.menu} role="dialog" aria-modal="true" aria-label={t('menu')}>
          {navLinks.map((link) => (
            <LocaleLink
              key={link.hash}
              href={{ pathname: '/', hash: link.hash }}
              onClick={() => setMenuOpen(false)}
              className={s.menuLink}
            >
              {link.label}
            </LocaleLink>
          ))}
          <Link href={loginHref} onClick={() => setMenuOpen(false)} className={s.menuLink}>
            {t('login')}
          </Link>
          <button type="button" onClick={switchLocale} className={s.menuLocale}>
            {locale === 'nl' ? 'EN' : 'NL'}
          </button>
          <div className={s.menuActions}>
            <a
              href={WHATSAPP_HREF}
              target="_blank"
              rel="noopener noreferrer"
              className={`${s.menuBtn} ${s.btnWhite}`}
              onClick={() => setMenuOpen(false)}
            >
              {t('getInTouch')}
            </a>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false)
                openModal()
              }}
              className={`${s.menuBtn} ${s.btnBlack}`}
            >
              {t('bookCall')}
            </button>
          </div>
          <button type="button" onClick={() => setMenuOpen(false)} className={s.close} aria-label={t('close')} />
        </div>
      )}
    </>
  )
}
