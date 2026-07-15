'use client'

// app/[locale]/privacy/data-request/page.tsx
//
// GDPR data-export request page (C8.1). Guest enters their email, confirms
// they're asking for their own data, solves Turnstile, submits. Response is
// always the same neutral message — same-page state swap, no navigation.

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { TurnstileWidget } from '@/components/consumer/booking/TurnstileWidget'
import { ConsumerLanguageToggle } from '@/components/consumer/ConsumerLanguageToggle'

type ViewState = 'form' | 'submitted'

export default function DataRequestPage() {
  const t = useTranslations('privacy.dataRequest')
  const locale = useLocale() as 'nl' | 'en'
  const [view, setView] = useState<ViewState>('form')
  const [email, setEmail] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting || !turnstileToken || !confirmed || !email.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/consumer/privacy/data-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          confirm: true,
          turnstileToken,
          locale,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data?.ok) {
        setError(t('errors.generic'))
        setSubmitting(false)
        return
      }
      setView('submitted')
      setSubmitting(false)
    } catch {
      setError(t('errors.generic'))
      setSubmitting(false)
    }
  }

  return (
    <main className="min-h-screen bg-cream px-4 py-10 font-body text-night">
      <div className="mx-auto flex max-w-[480px] justify-end pb-6">
        <ConsumerLanguageToggle />
      </div>

      <div className="mx-auto max-w-[480px] rounded-card bg-warm p-8 shadow-card">
        <div className="mb-6 flex justify-center">
          <EnvelopeIcon />
        </div>

        <h1 className="mb-3 text-center font-display text-[28px] font-black leading-tight text-night">
          {t('heading')}
        </h1>

        {view === 'form' ? (
          <>
            <p className="mb-6 text-center text-[14px] leading-relaxed text-stone">
              {t('intro')}
            </p>

            {error && (
              <div className="mb-4 rounded-2xl bg-[#f7e8e6] px-4 py-3 text-[13px] text-[#a13434]">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[13px] font-medium text-stone">{t('email_label')}</span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('email_placeholder')}
                  className="rounded-xl border-0 bg-white px-4 py-3 text-[15px] text-night outline-none ring-1 ring-warm2 focus:ring-2 focus:ring-amber"
                />
              </label>

              <label className="flex items-start gap-2.5 text-[13px] leading-relaxed text-stone">
                <input
                  type="checkbox"
                  required
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-amber"
                />
                <span>{t('confirm_label')}</span>
              </label>

              <div className="flex justify-center py-1">
                <TurnstileWidget onSuccess={setTurnstileToken} onError={() => setTurnstileToken(null)} />
              </div>

              <button
                type="submit"
                disabled={submitting || !turnstileToken || !confirmed || !email.trim()}
                aria-disabled={submitting || !turnstileToken || !confirmed || !email.trim()}
                className="tafel-tap mt-1 w-full rounded-pill bg-amber py-3.5 text-[14px] font-semibold tracking-wide text-cream disabled:opacity-50"
              >
                {submitting ? t('submitting') : t('submit')}
              </button>
            </form>
          </>
        ) : (
          <>
            <div className="mb-4 flex justify-center">
              <CheckIcon />
            </div>
            <p className="text-center text-[15px] leading-relaxed text-night">
              {t('submitted_body')}
            </p>
          </>
        )}
      </div>
    </main>
  )
}

function EnvelopeIcon() {
  return (
    <svg width="56" height="56" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4 7C4 5.9 4.9 5 6 5H22C23.1 5 24 5.9 24 7V21C24 22.1 23.1 23 22 23H6C4.9 23 4 22.1 4 21V7Z"
        stroke="#d4820a"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 7L14 15L24 7"
        stroke="#d4820a"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="14" cy="14" r="11" stroke="#d4820a" strokeWidth="2" />
      <path
        d="M9 14.5L12.2 17.7L19 10.5"
        stroke="#d4820a"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
