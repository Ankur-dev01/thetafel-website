'use client'

import { useState } from 'react'

type Props = {
  locale: 'nl' | 'en'
  variant: 'primary' | 'quiet'
  labels: { reconnect: string; connecting: string; error: string }
}

// Reuses the onboarding Mollie OAuth init route. `returnTo` is whitelisted
// server-side (payments page only) so the callback lands back here.
export default function ReconnectButton({ locale, variant, labels }: Props) {
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  async function start() {
    setBusy(true)
    setFailed(false)
    try {
      const res = await fetch('/api/v1/restaurants/mollie/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          locale,
          returnTo:
            locale === 'en'
              ? '/en/dashboard/settings/payments'
              : '/dashboard/settings/payments',
        }),
      })
      if (!res.ok) throw new Error('init_failed')
      const { authorize_url: url } = (await res.json()) as { authorize_url?: string }
      if (!url) throw new Error('no_url')
      window.location.href = url
    } catch {
      setFailed(true)
      setBusy(false)
    }
  }

  const fontStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif' } as const

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={busy}
        data-testid="payments-reconnect"
        className={
          variant === 'primary'
            ? 'rounded-full bg-amber text-white px-6 py-3 text-[14px] disabled:opacity-60'
            : 'text-[13px] text-[#6f6353] underline underline-offset-2 disabled:opacity-60'
        }
        style={{ ...fontStyle, fontWeight: variant === 'primary' ? 600 : 500 }}
      >
        {busy ? labels.connecting : labels.reconnect}
      </button>
      {failed && (
        <p role="alert" className="mt-2 text-[13px] text-[#c64a4a]" style={{ ...fontStyle, fontWeight: 400 }}>
          {labels.error}
        </p>
      )}
    </div>
  )
}
