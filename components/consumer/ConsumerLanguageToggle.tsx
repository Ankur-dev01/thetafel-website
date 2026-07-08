'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import { useLocale } from 'next-intl'
import { useRouter } from '@/i18n/routing'

/**
 * Language toggle (NL ↔ EN) for consumer pages — a two-position sliding pill.
 *
 * Implementation note: we still use `next/navigation`'s `usePathname` /
 * `useSearchParams` to compute the locale-agnostic path (stripping any "/en"
 * prefix ourselves), because we need the *other* locale's path explicitly.
 * The actual navigation, though, goes through next-intl's `useRouter` —
 * `router.replace(path, { locale })` — so the locale prefix is applied
 * correctly and consistently with every other locale-aware navigation in the
 * consumer app. `replace` (not `push`) avoids piling up a history entry per
 * language toggle.
 */
export function ConsumerLanguageToggle() {
  const pathname = usePathname() || '/'
  const searchParams = useSearchParams()
  const currentLocale = useLocale() as 'nl' | 'en'
  const router = useRouter()

  // Remove any existing locale prefix so we have a clean canonical path.
  const pathWithoutLocale = pathname.replace(/^\/(en|nl)(?=\/|$)/, '') || '/'

  const qs = searchParams?.toString() ?? ''
  const target = qs ? `${pathWithoutLocale}?${qs}` : pathWithoutLocale

  function switchTo(locale: 'nl' | 'en') {
    if (locale === currentLocale) return
    router.replace(target, { locale })
  }

  return (
    <div
      className="tafel-locale-toggle"
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        className="tafel-tap"
        aria-pressed={currentLocale === 'nl'}
        onClick={() => switchTo('nl')}
      >
        NL
      </button>
      <button
        type="button"
        className="tafel-tap"
        aria-pressed={currentLocale === 'en'}
        onClick={() => switchTo('en')}
      >
        EN
      </button>
      <span
        className="tafel-locale-slider"
        data-position={currentLocale}
        aria-hidden="true"
      />
    </div>
  )
}
