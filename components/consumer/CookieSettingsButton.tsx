'use client'

import { openCookieSettings } from '@/lib/consent'

export function CookieSettingsButton({ label, style }: { label: string; style?: React.CSSProperties }) {
  return (
    <button
      type="button"
      onClick={openCookieSettings}
      style={{
        color: 'var(--stone, #7a7264)',
        textDecoration: 'underline',
        background: 'none',
        border: 'none',
        padding: 0,
        font: 'inherit',
        cursor: 'pointer',
        ...style,
      }}
    >
      {label}
    </button>
  )
}
