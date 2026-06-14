'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import StepFrame from '@/components/onboarding/shell/StepFrame'
import SavedIndicator from '@/components/onboarding/shell/SavedIndicator'
import {
  getVisibleSteps,
  getTotalWizardSteps,
  getDisplayedStepNumber,
} from '@/lib/onboarding/steps'
import { stepPath, previousStepPath } from '@/lib/onboarding/routes'
import { useDraftSave } from '@/lib/onboarding/useDraftSave'

type MollieStatus = 'not_started' | 'pending' | 'verified' | 'rejected' | 'needs_action'
type UiState = 'not_connected' | 'started_not_finished' | 'pending_kyc' | 'verified' | 'needs_attention'

const POLL_INTERVAL_MS = 10000
const KNOWN_ERROR_REASONS = [
  'missing_params',
  'state_mismatch',
  'unauthorized',
  'restaurant_not_found',
  'token_exchange_failed',
  'organization_fetch_failed',
  'persist_failed',
] as const

// ---- Shared styles -----------------------------------------------------------

const sectionHeadingStyle: React.CSSProperties = {
  margin: '0 0 8px',
  fontFamily: 'var(--font-jost), Jost, sans-serif',
  fontWeight: 600,
  fontSize: '18px',
  color: '#1e1508',
}

const bodyTextStyle: React.CSSProperties = {
  fontFamily: 'var(--font-jost), Jost, sans-serif',
  fontWeight: 400,
  fontSize: '14px',
  lineHeight: 1.5,
  color: '#1e1508',
}

const primaryButtonStyle: React.CSSProperties = {
  padding: '12px 24px',
  borderRadius: '999px',
  border: 'none',
  background: '#d4820a',
  color: '#fff',
  fontFamily: 'var(--font-jost), Jost, sans-serif',
  fontWeight: 600,
  fontSize: '14px',
  cursor: 'pointer',
  transition: 'background 120ms ease',
}

// ---- Inline SVG icons --------------------------------------------------------

function CheckIcon({ color = '#5fb46f' }: { color?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="11" fill={color} fillOpacity="0.12" />
      <path d="M7 12.5l3 3 7-7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function WarningIcon({ color = '#c64a4a' }: { color?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3l10 18H2L12 3z" fill={color} fillOpacity="0.12" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12 10v4" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1" fill={color} />
    </svg>
  )
}

function PulseDot({ color = '#d4820a' }: { color?: string }) {
  return (
    <span
      aria-hidden
      style={{
        position: 'relative',
        display: 'inline-block',
        width: '12px',
        height: '12px',
      }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: color,
        }}
      />
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: color,
          opacity: 0.4,
          animation: 'tafel-pulse 1.6s ease-out infinite',
        }}
      />
    </span>
  )
}

// ---- Page --------------------------------------------------------------------

export default function PaymentsPage() {
  const t = useTranslations('onboarding.payments')
  const params = useParams<{ locale?: string }>()
  const locale: 'nl' | 'en' = params?.locale === 'en' ? 'en' : 'nl'
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { state: saveState, saveNow } = useDraftSave()

  // Wizard meta
  const [totalSteps, setTotalSteps] = useState(14)
  const [visibleStepIds, setVisibleStepIds] = useState<number[]>([])
  const [currentDisplayNum, setCurrentDisplayNum] = useState(11)

  // Mollie state
  const [mollieStatus, setMollieStatus] = useState<MollieStatus>('not_started')
  const [hasOrganization, setHasOrganization] = useState(false)

  // UI state
  const [hydrated, setHydrated] = useState(false)
  const [isConnecting, setIsConnecting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [bannerReason, setBannerReason] = useState<string | null>(null)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Refs for stable callbacks inside intervals
  const pollAbortRef = useRef<AbortController | null>(null)
  const intervalRef = useRef<number | null>(null)

  // ---- Read query params on mount ------------------------------------------

  useEffect(() => {
    const m = searchParams.get('mollie')
    const reason = searchParams.get('reason')
    if (m === 'error' && reason) {
      setBannerReason(reason)
      setBannerDismissed(false)
    }
  }, [searchParams])

  // ---- Hydration -----------------------------------------------------------

  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      try {
        const res = await fetch('/api/v1/restaurants/draft', {
          method: 'GET',
          cache: 'no-store',
        })
        if (!res.ok) {
          if (!cancelled) setHydrated(true)
          return
        }
        const data = (await res.json()) as Record<string, unknown>
        if (cancelled) return

        const r = (data?.restaurant ?? {}) as Record<string, unknown>

        try {
          const visibleSteps = getVisibleSteps(
            r as Parameters<typeof getVisibleSteps>[0]
          )
          setTotalSteps(getTotalWizardSteps(visibleSteps))
          setVisibleStepIds(visibleSteps.map((s) => s.id))
          setCurrentDisplayNum(getDisplayedStepNumber(11, visibleSteps) ?? 11)
        } catch {
          // leave defaults
        }

        const statusVal = r.mollie_status
        if (
          statusVal === 'not_started' ||
          statusVal === 'pending' ||
          statusVal === 'verified' ||
          statusVal === 'rejected' ||
          statusVal === 'needs_action'
        ) {
          setMollieStatus(statusVal)
        } else {
          setMollieStatus('not_started')
        }

        setHasOrganization(
          typeof r.mollie_organization_id === 'string' &&
            r.mollie_organization_id.length > 0
        )

        if (!cancelled) setHydrated(true)
      } catch {
        if (!cancelled) setHydrated(true)
      }
    }
    void hydrate()
    return () => {
      cancelled = true
    }
  }, [pathname])

  // ---- Polling -------------------------------------------------------------

  const pollOnce = useCallback(async () => {
    if (pollAbortRef.current) pollAbortRef.current.abort()
    const ac = new AbortController()
    pollAbortRef.current = ac
    try {
      const res = await fetch('/api/v1/restaurants/mollie/status', {
        method: 'GET',
        cache: 'no-store',
        signal: ac.signal,
      })
      if (!res.ok) return
      const data = await res.json()
      const next = data?.mollie_status as MollieStatus | undefined
      if (
        next === 'not_started' ||
        next === 'pending' ||
        next === 'verified' ||
        next === 'rejected' ||
        next === 'needs_action'
      ) {
        setMollieStatus(next)
      }
      setHasOrganization(Boolean(data?.has_organization))
    } catch {
      // Network blip; the next interval retries.
    }
  }, [])

  // Poll only when KYC is unresolved AND tokens stored
  useEffect(() => {
    if (!hydrated) return
    const shouldPoll = mollieStatus === 'pending' && hasOrganization
    if (!shouldPoll) {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }
    void pollOnce()
    intervalRef.current = window.setInterval(() => {
      void pollOnce()
    }, POLL_INTERVAL_MS)
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      if (pollAbortRef.current) pollAbortRef.current.abort()
    }
  }, [hydrated, mollieStatus, hasOrganization, pollOnce])

  // Active KYC poll — calls Mollie's onboarding API every 30 s while non-terminal
  useEffect(() => {
    if (mollieStatus === 'verified' || mollieStatus === 'rejected') return
    if (!hasOrganization) return

    let cancelled = false

    async function pollKyc() {
      if (cancelled) return
      try {
        const res = await fetch('/api/v1/restaurants/mollie/kyc-status', { cache: 'no-store' })
        if (res.ok) {
          const data = (await res.json()) as { status?: string }
          if (
            data.status &&
            (data.status === 'not_started' ||
              data.status === 'pending' ||
              data.status === 'verified' ||
              data.status === 'rejected' ||
              data.status === 'needs_action') &&
            data.status !== mollieStatus
          ) {
            setMollieStatus(data.status as MollieStatus)
          }
        }
      } catch {
        // ignore transient failures
      }
      if (!cancelled) {
        window.setTimeout(pollKyc, 30_000)
      }
    }

    void pollKyc()

    return () => {
      cancelled = true
    }
  }, [hasOrganization, mollieStatus])

  // ---- Derived UI state ----------------------------------------------------

  function deriveUiState(): UiState {
    if (mollieStatus === 'verified') return 'verified'
    if (mollieStatus === 'rejected' || mollieStatus === 'needs_action') return 'needs_attention'
    if (mollieStatus === 'pending' && hasOrganization) return 'pending_kyc'
    if (mollieStatus === 'pending' && !hasOrganization) return 'started_not_finished'
    return 'not_connected'
  }
  const uiState = deriveUiState()

  // ---- Handlers ------------------------------------------------------------

  async function handleSetUp() {
    if (!hydrated || isConnecting) return
    setActionError(null)
    setIsConnecting(true)
    try {
      const res = await fetch('/api/v1/restaurants/mollie/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale }),
      })
      if (!res.ok) throw new Error('init_failed')
      const data = await res.json()
      const url = data?.authorize_url
      if (typeof url !== 'string' || url.length === 0) throw new Error('no_url')
      window.location.href = url
    } catch {
      setActionError(t('cta.connectFailed'))
      setIsConnecting(false)
    }
  }

  async function handleContinue() {
    if (submitting || !hasOrganization) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const currIdx = visibleStepIds.indexOf(11)
      const nextStepId =
        currIdx >= 0 && currIdx < visibleStepIds.length - 1
          ? visibleStepIds[currIdx + 1]!
          : 12
      await saveNow({
        restaurant: { current_onboarding_step: nextStepId },
      })
      const nextPath = stepPath(nextStepId, locale)
      if (nextPath) router.push(nextPath)
    } catch {
      setSubmitError(t('saveFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  // ---- Derived -------------------------------------------------------------

  const backHref = previousStepPath(11, visibleStepIds, locale) ?? stepPath(10, locale)

  function bannerMessage(reason: string): string {
    const key = (KNOWN_ERROR_REASONS as readonly string[]).includes(reason)
      ? `errorBanner.reasons.${reason}`
      : 'errorBanner.reasons.unknown'
    return t(key as Parameters<typeof t>[0])
  }

  // ---- Render --------------------------------------------------------------

  return (
    <StepFrame
      locale={locale}
      showProgress
      currentStepDisplayNumber={currentDisplayNum}
      totalSteps={totalSteps}
      serviceTag={t('serviceTag')}
      heading={t('heading')}
      subHeading={t('sub')}
      backHref={backHref}
      canContinue={hasOrganization}
      continueLabel={t('continue')}
      onContinue={handleContinue}
      isSubmitting={submitting}
      error={submitError}
      savedIndicator={<SavedIndicator state={saveState} locale={locale} />}
    >
      <style>{`
        @keyframes tafel-pulse {
          0% { transform: scale(1); opacity: 0.4; }
          100% { transform: scale(2.4); opacity: 0; }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Error banner */}
        {bannerReason && !bannerDismissed && (
          <div style={{
            padding: '14px 16px',
            background: 'rgba(198,74,74,0.08)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            fontFamily: 'var(--font-jost), Jost, sans-serif',
          }}>
            <WarningIcon />
            <div style={{ flex: 1, fontSize: '13px', color: '#1e1508', lineHeight: 1.5 }}>
              {bannerMessage(bannerReason)}
            </div>
            <button
              type="button"
              onClick={() => setBannerDismissed(true)}
              aria-label={t('errorBanner.dismiss')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#9c8b6a',
                cursor: 'pointer',
                fontSize: '18px',
                lineHeight: 1,
                padding: '0 4px',
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* Status card */}
        <section
          style={{
            padding: '24px',
            borderRadius: '12px',
            background:
              uiState === 'verified' ? 'rgba(95,180,111,0.06)' :
              uiState === 'needs_attention' ? 'rgba(198,74,74,0.06)' :
              uiState === 'pending_kyc' ? 'rgba(212,130,10,0.06)' :
              '#f8f2e6',
          }}
        >
          {uiState === 'not_connected' && (
            <>
              <h2 style={sectionHeadingStyle}>{t('statusCard.notConnected.title')}</h2>
              <p style={{ ...bodyTextStyle, marginTop: 0, marginBottom: '20px' }}>
                {t('statusCard.notConnected.body')}
              </p>
              <button
                type="button"
                onClick={() => void handleSetUp()}
                disabled={!hydrated || isConnecting}
                style={{
                  ...primaryButtonStyle,
                  background: isConnecting || !hydrated ? '#9c8b6a' : '#d4820a',
                  cursor: isConnecting || !hydrated ? 'not-allowed' : 'pointer',
                }}
              >
                {isConnecting ? t('cta.opening') : t('cta.setUp')}
              </button>
              {actionError && (
                <p style={{ ...bodyTextStyle, marginTop: '12px', color: '#c64a4a' }}>
                  {actionError}
                </p>
              )}
            </>
          )}

          {uiState === 'started_not_finished' && (
            <>
              <h2 style={sectionHeadingStyle}>{t('statusCard.startedNotFinished.title')}</h2>
              <p style={{ ...bodyTextStyle, marginTop: 0, marginBottom: '20px' }}>
                {t('statusCard.startedNotFinished.body')}
              </p>
              <button
                type="button"
                onClick={() => void handleSetUp()}
                disabled={!hydrated || isConnecting}
                style={{
                  ...primaryButtonStyle,
                  background: isConnecting || !hydrated ? '#9c8b6a' : '#d4820a',
                  cursor: isConnecting || !hydrated ? 'not-allowed' : 'pointer',
                }}
              >
                {isConnecting ? t('cta.opening') : t('cta.continueSetup')}
              </button>
              {actionError && (
                <p style={{ ...bodyTextStyle, marginTop: '12px', color: '#c64a4a' }}>
                  {actionError}
                </p>
              )}
            </>
          )}

          {uiState === 'pending_kyc' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <PulseDot />
                <h2 style={{ ...sectionHeadingStyle, margin: 0 }}>
                  {t('statusCard.pendingKyc.title')}
                </h2>
              </div>
              <p style={{ ...bodyTextStyle, margin: 0 }}>
                {t('statusCard.pendingKyc.body')}
              </p>
            </>
          )}

          {uiState === 'verified' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <CheckIcon />
                <h2 style={{ ...sectionHeadingStyle, margin: 0 }}>
                  {t('statusCard.verified.title')}
                </h2>
              </div>
              <p style={{ ...bodyTextStyle, margin: 0 }}>
                {t('statusCard.verified.body')}
              </p>
            </>
          )}

          {uiState === 'needs_attention' && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <WarningIcon />
                <h2 style={{ ...sectionHeadingStyle, margin: 0 }}>
                  {t('statusCard.needsAttention.title')}
                </h2>
              </div>
              <p style={{ ...bodyTextStyle, marginTop: 0, marginBottom: '20px' }}>
                {t('statusCard.needsAttention.body')}
              </p>
              <button
                type="button"
                onClick={() => void handleSetUp()}
                disabled={!hydrated || isConnecting}
                style={{
                  ...primaryButtonStyle,
                  background: isConnecting || !hydrated ? '#9c8b6a' : '#d4820a',
                  cursor: isConnecting || !hydrated ? 'not-allowed' : 'pointer',
                }}
              >
                {isConnecting ? t('cta.opening') : t('cta.relink')}
              </button>
              {actionError && (
                <p style={{ ...bodyTextStyle, marginTop: '12px', color: '#c64a4a' }}>
                  {actionError}
                </p>
              )}
            </>
          )}
        </section>

        {/* Deposit nudge — shown whenever Mollie is connected (pending or verified) */}
        {hasOrganization && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
              padding: '16px 18px',
              backgroundColor: 'rgba(212, 130, 10, 0.08)',
              border: '1px solid rgba(212, 130, 10, 0.25)',
              borderRadius: 12,
            }}
          >
            <span
              aria-hidden
              style={{
                flexShrink: 0,
                width: 28,
                height: 28,
                borderRadius: '50%',
                backgroundColor: '#d4820a',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: 2,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                <path
                  d="M7 3.5V7.5M7 9.5V9.6"
                  stroke="#fdfaf5"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
              <p
                style={{
                  margin: 0,
                  fontFamily: 'var(--font-jost), Jost, sans-serif',
                  fontSize: 14,
                  color: '#1e1508',
                  lineHeight: 1.55,
                }}
              >
                {t('paymentsConnected.depositNudge')}
              </p>
              <a
                href={locale === 'en' ? '/en/onboarding/no-shows' : '/onboarding/no-shows'}
                style={{
                  alignSelf: 'flex-start',
                  fontFamily: 'var(--font-jost), Jost, sans-serif',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#1e1508',
                  padding: '8px 14px',
                  border: '1px solid #1e1508',
                  borderRadius: 999,
                  textDecoration: 'none',
                }}
              >
                {t('paymentsConnected.depositNudgeCta')}
              </a>
            </div>
          </div>
        )}

        {/* Info card — what's shared with Mollie */}
        <section style={{
          padding: '20px',
          borderRadius: '12px',
          background: '#f8f2e6',
        }}>
          <h3 style={{ ...sectionHeadingStyle, fontSize: '15px', marginBottom: '12px' }}>
            {t('info.title')}
          </h3>
          <ul style={{
            ...bodyTextStyle,
            margin: 0,
            paddingLeft: '20px',
            listStyle: 'disc',
          }}>
            <li style={{ marginBottom: '6px' }}>{t('info.bullet1')}</li>
            <li style={{ marginBottom: '6px' }}>{t('info.bullet2')}</li>
            <li>{t('info.bullet3')}</li>
          </ul>
        </section>

      </div>
    </StepFrame>
  )
}
