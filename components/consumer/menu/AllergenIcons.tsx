'use client'

import { useTranslations } from 'next-intl'

type AllergenCode =
  | 'contains_gluten'
  | 'contains_dairy'
  | 'contains_egg'
  | 'contains_nuts'
  | 'contains_peanuts'
  | 'contains_soy'
  | 'contains_fish'
  | 'contains_shellfish'
  | 'contains_sesame'
  | 'contains_mustard'
  | 'contains_alcohol'
  | 'spicy'

const KNOWN_CODES: readonly AllergenCode[] = [
  'contains_gluten',
  'contains_dairy',
  'contains_egg',
  'contains_nuts',
  'contains_peanuts',
  'contains_soy',
  'contains_fish',
  'contains_shellfish',
  'contains_sesame',
  'contains_mustard',
  'contains_alcohol',
  'spicy',
]

function iconPathFor(code: AllergenCode) {
  switch (code) {
    case 'contains_gluten':
      return (
        <>
          <path d="M12 21V6" />
          <path d="M12 7c-1.6-1.8-3.4-2.5-5.2-2.2.4 1.8 1.6 3.1 3.4 3.6" />
          <path d="M12 7c1.6-1.8 3.4-2.5 5.2-2.2-.4 1.8-1.6 3.1-3.4 3.6" />
          <path d="M12 11.5c-1.6-1.8-3.4-2.5-5.2-2.2.4 1.8 1.6 3.1 3.4 3.6" />
          <path d="M12 11.5c1.6-1.8 3.4-2.5 5.2-2.2-.4 1.8-1.6 3.1-3.4 3.6" />
          <path d="M12 16c-1.6-1.8-3.4-2.5-5.2-2.2.4 1.8 1.6 3.1 3.4 3.6" />
          <path d="M12 16c1.6-1.8 3.4-2.5 5.2-2.2-.4 1.8-1.6 3.1-3.4 3.6" />
        </>
      )
    case 'contains_dairy':
      return (
        <>
          <path
            d="M9.5 3h5l.5 3.5-1.3 1.8V20a1 1 0 0 1-1 1h-4.4a1 1 0 0 1-1-1V8.3L8.5 6.5z"
            fill="currentColor"
            fillOpacity="0.08"
          />
          <path d="M9.5 6.5h5" />
        </>
      )
    case 'contains_egg':
      return <path d="M12 3c2.6 2.6 5 8.3 5 12a5 5 0 0 1-10 0c0-3.7 2.4-9.4 5-12z" />
    case 'contains_nuts':
      return (
        <>
          <path d="M12 3.5c-3.3 0-5.8 3.3-5.8 8s2.5 9 5.8 9 5.8-4.3 5.8-9-2.5-8-5.8-8z" />
          <path d="M12 3.5v17" />
          <path d="M7.3 9.5c1.5 1 3.2 1 4.7 0M12 9.5c1.5 1 3.2 1 4.7 0" />
        </>
      )
    case 'contains_peanuts':
      return (
        <>
          <path d="M10 3.2c-2.4.4-3.8 2.4-3.5 4.7.1.9-.4 1.3-.8 2.1-.6 1.1-.7 2.3-.2 3.5.6 1.5-.1 2 .1 3.3.4 2.3 2.5 3.7 4.7 3s3.2-2.7 2.8-5c-.2-1.3.6-1.6.9-2.8.3-1.2 0-2.4-.8-3.3-.6-.7-.2-1.2-.4-2.1-.5-2.3-2.4-3.8-4.8-3.4z" />
          <path d="M7.4 11.8a2.6 2.6 0 0 0 4.9 1.8" />
        </>
      )
    case 'contains_soy':
      return (
        <>
          <path d="M12 3c3 2 4 5 4 8.5 0 4-2 8.5-4 8.5s-4-4.5-4-8.5c0-3.5 1-6.5 4-8.5z" />
          <circle cx="10.3" cy="11" r="1.4" />
          <circle cx="13.7" cy="14" r="1.4" />
        </>
      )
    case 'contains_fish':
      return (
        <>
          <path d="M3 12c3-4 8-6 12-4 2 1 4 2.5 6 4-2 1.5-4 3-6 4-4 2-9 0-12-4z" />
          <circle cx="16" cy="10.5" r="0.8" />
          <path d="M3 12l-2-2.5M3 12l-2 2.5" />
        </>
      )
    case 'contains_shellfish':
      return (
        <>
          <path d="M12 4c4 1 7 5 7 10a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1c0-5 3-9 7-10z" />
          <path d="M12 4v11M9 8v6M15 8v6" />
        </>
      )
    case 'contains_sesame':
      return (
        <>
          <circle cx="8" cy="9" r="2" />
          <circle cx="16" cy="9" r="2" />
          <circle cx="12" cy="16" r="2" />
        </>
      )
    case 'contains_mustard':
      return (
        <>
          <path d="M10 3h4v2h1.5a1 1 0 0 1 1 1v1l-1.5 2v10a1 1 0 0 1-1 1H10a1 1 0 0 1-1-1V9L7.5 7V6a1 1 0 0 1 1-1H10z" />
          <path d="M9.5 12h5" />
        </>
      )
    case 'contains_alcohol':
      return (
        <>
          <path d="M7 4h10l-3.5 8v7M12 19v2M9 21h6" />
          <path d="M7 4a5 5 0 0 0 10 0" />
        </>
      )
    case 'spicy':
      return (
        <>
          <path d="M9 5.5c1-1.2 2.2-1.8 3.5-1.8" />
          <path d="M8.5 6c-2.3 1-3.8 3.4-3.8 6.2 0 4 2.8 7.3 6.3 7.3s6.3-3.3 6.3-7.3c0-2.6-1.2-4.8-3-6" />
          <path d="M8.5 6c1.6.3 2.8 1.7 2.8 3.4" />
        </>
      )
  }
}

/**
 * Renders the allergen/spicy icon row. Unknown codes are silently skipped.
 */
export function AllergenIcons({ codes }: { codes: string[] }) {
  const t = useTranslations('consumer.menu.allergens')
  const known = codes.filter((c): c is AllergenCode =>
    KNOWN_CODES.includes(c as AllergenCode)
  )

  if (known.length === 0) return null

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        color: 'var(--stone, #7a7264)',
      }}
    >
      {known.map((code) => (
        <svg
          key={code}
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          role="img"
        >
          <title>{t(code)}</title>
          {iconPathFor(code)}
        </svg>
      ))}
    </div>
  )
}
