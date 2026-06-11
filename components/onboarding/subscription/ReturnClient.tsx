'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'

type State = 'confirming' | 'success' | 'failed' | 'timeout'

interface Props {
  locale: string
  paymentId: string | null
}

export default function ReturnClient({ locale, paymentId }: Props) {
  const router = useRouter()
  const t = useTranslations('onboarding.subscription.return')
  const [state, setState] = useState<State>(() => (paymentId ? 'confirming' : 'failed'))
  const cancelledRef = useRef(false)

  useEffect(() => {
    if (!paymentId) {
      return
    }

    cancelledRef.current = false
    const startMs = Date.now()
    const maxMs = 30_000
    const intervalMs = 2_000

    async function tick() {
      if (cancelledRef.current) return

      try {
        const res = await fetch(
          `/api/v1/restaurants/subscription/payment-status/${paymentId}`,
          { cache: 'no-store' }
        )
        if (res.ok) {
          const data = (await res.json()) as { status?: string }
          if (data.status === 'paid') {
            if (!cancelledRef.current) {
              setState('success')
              window.setTimeout(() => {
                if (!cancelledRef.current) {
                  router.push(`/${locale}/onboarding/contract`)
                }
              }, 1200)
            }
            return
          }
          if (
            data.status === 'failed' ||
            data.status === 'expired' ||
            data.status === 'canceled'
          ) {
            if (!cancelledRef.current) setState('failed')
            return
          }
        }
      } catch {
        // Network blip — retry on next tick.
      }

      if (Date.now() - startMs >= maxMs) {
        if (!cancelledRef.current) setState('timeout')
        return
      }

      window.setTimeout(tick, intervalMs)
    }

    void tick()

    return () => {
      cancelledRef.current = true
    }
  }, [paymentId, locale, router])

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 24px',
      }}
    >
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center' }}>
        {state === 'confirming' && (
          <>
            <Spinner />
            <h1
              style={{
                fontFamily: 'var(--font-raleway), sans-serif',
                fontWeight: 900,
                fontSize: '32px',
                color: '#1e1508',
                marginTop: 24,
                marginBottom: 12,
              }}
            >
              {t('confirming.title')}
            </h1>
            <p style={{ fontFamily: 'var(--font-jost), sans-serif', fontWeight: 400, color: '#1e1508', opacity: 0.7 }}>
              {t('confirming.subtitle')}
            </p>
          </>
        )}

        {state === 'success' && (
          <>
            <SuccessIcon />
            <h1
              style={{
                fontFamily: 'var(--font-raleway), sans-serif',
                fontWeight: 900,
                fontSize: '32px',
                color: '#1e1508',
                marginTop: 24,
                marginBottom: 12,
              }}
            >
              {t('success.title')}
            </h1>
            <p style={{ fontFamily: 'var(--font-jost), sans-serif', fontWeight: 400, color: '#1e1508', opacity: 0.7 }}>
              {t('success.subtitle')}
            </p>
          </>
        )}

        {state === 'failed' && (
          <>
            <FailedIcon />
            <h1
              style={{
                fontFamily: 'var(--font-raleway), sans-serif',
                fontWeight: 900,
                fontSize: '32px',
                color: '#1e1508',
                marginTop: 24,
                marginBottom: 12,
              }}
            >
              {t('failed.title')}
            </h1>
            <p
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontWeight: 400,
                color: '#1e1508',
                opacity: 0.7,
                marginBottom: 24,
              }}
            >
              {t('failed.subtitle')}
            </p>
            <a
              href={`/${locale}/onboarding/subscription`}
              style={{
                display: 'inline-block',
                padding: '12px 28px',
                background: '#d4820a',
                color: '#fdfaf5',
                fontFamily: 'var(--font-jost), sans-serif',
                fontWeight: 600,
                textDecoration: 'none',
                borderRadius: 999,
              }}
            >
              {t('failed.cta')}
            </a>
          </>
        )}

        {state === 'timeout' && (
          <>
            <TimeoutIcon />
            <h1
              style={{
                fontFamily: 'var(--font-raleway), sans-serif',
                fontWeight: 900,
                fontSize: '32px',
                color: '#1e1508',
                marginTop: 24,
                marginBottom: 12,
              }}
            >
              {t('timeout.title')}
            </h1>
            <p
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontWeight: 400,
                color: '#1e1508',
                opacity: 0.7,
                marginBottom: 24,
              }}
            >
              {t('timeout.subtitle')}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: '12px 28px',
                background: '#d4820a',
                color: '#fdfaf5',
                fontFamily: 'var(--font-jost), sans-serif',
                fontWeight: 600,
                border: 'none',
                borderRadius: 999,
                cursor: 'pointer',
              }}
            >
              {t('timeout.cta')}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48" style={{ animation: 'spin 1s linear infinite' }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      <circle cx="24" cy="24" r="20" fill="none" stroke="#d4820a" strokeWidth="3" strokeDasharray="80 40" strokeLinecap="round" />
    </svg>
  )
}

function SuccessIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="22" fill="#d4820a" />
      <path d="M14 25 L21 31 L34 17" stroke="#fdfaf5" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function FailedIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="22" fill="none" stroke="#9c8b6a" strokeWidth="3" />
      <path d="M17 17 L31 31 M31 17 L17 31" stroke="#9c8b6a" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function TimeoutIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 48 48">
      <circle cx="24" cy="24" r="22" fill="none" stroke="#9c8b6a" strokeWidth="3" />
      <path d="M24 12 L24 24 L32 28" stroke="#9c8b6a" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
