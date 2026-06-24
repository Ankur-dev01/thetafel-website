'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useLocale } from 'next-intl'
import Link from 'next/link'

/**
 * Language toggle (NL ↔ EN) for consumer pages.
 *
 * Implementation note: we deliberately use `next/navigation`'s `usePathname`
 * and a plain `next/link` here, NOT next-intl's locale-aware Link, because we
 * need to construct the *other* locale's full path explicitly and avoid any
 * surprise locale rewriting on the toggle itself.
 *
 * Path-rewrite rules:
 *   - Strip a leading "/en" if present, then prefix "/en" if switching to EN.
 *   - Dutch (the default) lives at the bare root path with no prefix.
 *   - Preserve query string so e.g. "?date=2026-07-01" survives the toggle.
 */
export function ConsumerLanguageToggle() {
  const pathname = usePathname() || '/'
  const searchParams = useSearchParams()
  const currentLocale = useLocale()

  // Remove any existing locale prefix so we have a clean canonical path.
  const pathWithoutLocale = pathname.replace(/^\/(en|nl)(?=\/|$)/, '') || '/'

  // Build the target path for the *other* locale.
  const otherLocale: 'nl' | 'en' = currentLocale === 'en' ? 'nl' : 'en'
  const targetPath =
    otherLocale === 'en'
      ? `/en${pathWithoutLocale === '/' ? '' : pathWithoutLocale}`
      : pathWithoutLocale

  const qs = searchParams?.toString() ?? ''
  const target = qs ? `${targetPath}?${qs}` : targetPath

  const activeStyle = {
    color: 'var(--night, #0f0d08)',
    fontWeight: 700,
  }
  const inactiveStyle = {
    color: 'var(--stone, #7a7264)',
    fontWeight: 400,
    textDecoration: 'none',
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontFamily: 'var(--font-jost), sans-serif',
        fontSize: '13px',
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
      }}
      aria-label="Language switcher"
    >
      {currentLocale === 'nl' ? (
        <span aria-current="true" style={activeStyle}>NL</span>
      ) : (
        <Link href={target} prefetch={false} style={inactiveStyle}>NL</Link>
      )}
      <span style={{ color: 'var(--stone, #7a7264)' }} aria-hidden="true">/</span>
      {currentLocale === 'en' ? (
        <span aria-current="true" style={activeStyle}>EN</span>
      ) : (
        <Link href={target} prefetch={false} style={inactiveStyle}>EN</Link>
      )}
    </div>
  )
}
