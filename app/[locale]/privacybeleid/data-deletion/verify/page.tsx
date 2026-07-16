'use client'

// app/[locale]/privacybeleid/data-deletion/verify/page.tsx
//
// GDPR data-deletion verify page (C8.2). Reads the token from the URL,
// calls the verify route on mount, shows sending / success / blocked /
// failure. No form — clicking the emailed link is the confirmation.

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'
import { ConsumerLanguageToggle } from '@/components/consumer/ConsumerLanguageToggle'

type VerifyState = 'sending' | 'success' | 'blocked' | 'failure'
type BlockReason = 'upcoming_booking' | 'active_order' | 'payment_in_flight' | null

export default function DataDeletionVerifyPage() {
  const t = useTranslations('privacy.dataDeletion.verify')
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const [state, setState] = useState<VerifyState>(token ? 'sending' : 'failure')
  const [blockReason, setBlockReason] = useState<BlockReason>(null)
  const calledRef = useRef(false)

  useEffect(() => {
    if (!token || calledRef.current) return
    calledRef.current = true

    async function verify() {
      try {
        const res = await fetch('/api/consumer/privacy/data-deletion/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        })
        const data = await res.json().catch(() => ({}))
        if (res.ok && data?.ok) {
          setState('success')
        } else if (res.status === 409 && data?.error === 'blocked') {
          setBlockReason(data.reason ?? null)
          setState('blocked')
        } else {
          setState('failure')
        }
      } catch {
        setState('failure')
      }
    }
    void verify()
  }, [token])

  const blockedText =
    blockReason === 'upcoming_booking'
      ? t('blocked.upcoming_booking')
      : blockReason === 'active_order'
        ? t('blocked.active_order')
        : blockReason === 'payment_in_flight'
          ? t('blocked.payment_in_flight')
          : t('blocked.generic')

  return (
    <main className="min-h-screen bg-cream px-4 py-10 font-body text-night">
      <div className="mx-auto flex max-w-[480px] justify-end pb-6">
        <ConsumerLanguageToggle />
      </div>

      <div className="mx-auto max-w-[480px] rounded-card bg-warm p-8 text-center shadow-card">
        <div className="mb-6 flex justify-center">
          {state === 'sending' && <SendingIcon />}
          {state === 'success' && <CheckIcon />}
          {(state === 'blocked' || state === 'failure') && <WarningIcon />}
        </div>

        <h1 className="mb-3 font-display text-[28px] font-black leading-tight text-night">
          {state === 'sending' && t('sending_heading')}
          {state === 'success' && t('success_heading')}
          {state === 'blocked' && t('blocked_heading')}
          {state === 'failure' && t('failure_heading')}
        </h1>

        <p className="text-[15px] leading-relaxed text-stone">
          {state === 'sending' && t('sending_body')}
          {state === 'success' && t('success_body')}
          {state === 'blocked' && blockedText}
          {state === 'failure' && t('failure_body')}
        </p>
      </div>
    </main>
  )
}

function SendingIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 28 28"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="animate-spin"
      style={{ animationDuration: '1.4s' }}
    >
      <circle cx="14" cy="14" r="11" stroke="#f0e8d8" strokeWidth="3" />
      <path d="M14 3C19.5228 3 24 7.47715 24 13" stroke="#d4820a" strokeWidth="3" strokeLinecap="round" />
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

function WarningIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M14 4L25 23H3L14 4Z" stroke="#a13434" strokeWidth="2" strokeLinejoin="round" />
      <path d="M14 11V16" stroke="#a13434" strokeWidth="2" strokeLinecap="round" />
      <circle cx="14" cy="19.5" r="1.2" fill="#a13434" />
    </svg>
  )
}
