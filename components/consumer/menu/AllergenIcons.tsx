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
          <path d="M12 3v18" />
          <path d="M12 5c-2 0-3 1.4-3 3s1 3 3 3 3 1.4 3 3-1 3-3 3" />
          <path d="M9 6.5 6.5 4M15 6.5 17.5 4M9 11.5 6.5 9M15 11.5 17.5 9M9 16.5 6.5 19M15 16.5 17.5 19" />
        </>
      )
    case 'contains_dairy':
      return (
        <>
          <path d="M9 3h6v3l1.5 2.5V20a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1V8.5L9 6z" />
          <path d="M8.5 12h7" />
        </>
      )
    case 'contains_egg':
      return <path d="M12 3C8.5 3 6 10 6 15a6 6 0 0 0 12 0c0-5-2.5-12-6-12z" />
    case 'contains_nuts':
      return (
        <>
          <path d="M12 4c-3.5 0-5.5 3-5.5 7s2.2 9 5.5 9 5.5-5 5.5-9-2-7-5.5-7z" />
          <path d="M12 4v16" />
          <path d="M6.8 10.5c1.6.8 3.4.8 5.2 0M12 10.5c1.8.8 3.6.8 5.2 0" />
        </>
      )
    case 'contains_peanuts':
      return (
        <>
          <path d="M9.5 4.5C7 5.5 6 8 6.5 10.5c.4 2-1 3-1 5.5A5 5 0 0 0 15 18c1.5-2 2.5-2.5 2.5-5 0-2.5-1-4.5-2.7-6C13 5.3 11.8 3.7 9.5 4.5z" />
          <path d="M9.5 11.5a3 3 0 1 0 5 0" />
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
          <path d="M8 6c-1.5 0-2 1.2-1.5 2.5C5 9 4.5 11 5.5 13c1 2.5 4 6 8 6 3.5 0 6-3 6-6.5C19.5 8 16 5 12.5 5" />
          <path d="M8 6c1-1.5 2.7-2.3 4-2" />
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
        gap: '6px',
        marginTop: '8px',
        color: 'var(--stone, #7a7264)',
      }}
    >
      {known.map((code) => (
        <svg
          key={code}
          width="18"
          height="18"
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
