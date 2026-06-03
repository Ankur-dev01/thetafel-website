'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useParams, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import StepFrame from '@/components/onboarding/shell/StepFrame'
import CardChoice from '@/components/onboarding/fields/CardChoice'
import SavedIndicator from '@/components/onboarding/shell/SavedIndicator'
import { useDraftSave } from '@/lib/onboarding/useDraftSave'
import { stepPath } from '@/lib/onboarding/routes'
import type { Locale } from '@/lib/onboarding/routes'

type ServiceFlags = {
  service_reservations_enabled: boolean
  service_takeaway_enabled: boolean
  service_qr_enabled: boolean
}

const SERVICE_KEYS = [
  'service_reservations_enabled',
  'service_takeaway_enabled',
  'service_qr_enabled',
] as const

export default function ServicePickerPage() {
  const t = useTranslations('onboarding.services')
  const router = useRouter()
  const params = useParams()
  const locale = ((params?.locale as string) || 'nl') as Locale
  const pathname = usePathname()

  const [flags, setFlags] = useState<ServiceFlags>({
    service_reservations_enabled: false,
    service_takeaway_enabled: false,
    service_qr_enabled: false,
  })
  const [hydrating, setHydrating] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [advancing, setAdvancing] = useState(false)

  const { saveNow, state: saveState } = useDraftSave()

  // ─── Hydrate from the existing draft ─────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      try {
        const res = await fetch('/api/v1/restaurants/draft', {
          method: 'GET',
          cache: 'no-store',
        })
        if (!res.ok) {
          if (!cancelled) setHydrating(false)
          return
        }
        const data = await res.json()
        const r =
          data?.restaurant ??
          data?.data?.restaurant ??
          data?.draft?.restaurant ??
          data
        if (!cancelled && r) {
          setFlags({
            service_reservations_enabled: Boolean(r.service_reservations_enabled),
            service_takeaway_enabled: Boolean(r.service_takeaway_enabled),
            service_qr_enabled: Boolean(r.service_qr_enabled),
          })
        }
      } catch {
        // Silent — user can still pick services; we just don't pre-check.
      } finally {
        if (!cancelled) setHydrating(false)
      }
    }
    hydrate()
    return () => {
      cancelled = true
    }
  }, [pathname])

  // ─── Card toggle handler ─────────────────────────────────────────────────
  const handleToggle = useCallback(
    async (key: (typeof SERVICE_KEYS)[number]) => {
      const previous = flags[key]
      const next = !previous
      setFlags((prev) => ({ ...prev, [key]: next }))
      setPageError(null)
      try {
        await saveNow({ restaurant: { [key]: next } })
      } catch {
        setFlags((prev) => ({ ...prev, [key]: previous }))
        setPageError(t('errorSave'))
      }
    },
    [flags, saveNow, t]
  )

  // ─── Continue handler ────────────────────────────────────────────────────
  const atLeastOneSelected =
    flags.service_reservations_enabled ||
    flags.service_takeaway_enabled ||
    flags.service_qr_enabled

  const handleContinue = useCallback(async () => {
    if (!atLeastOneSelected || advancing) return
    setAdvancing(true)
    setPageError(null)
    try {
      await saveNow({ restaurant: { current_onboarding_step: 1 } })
      const nextPath = stepPath(1, locale)
      if (nextPath) router.push(nextPath)
    } catch {
      setPageError(t('errorAdvance'))
      setAdvancing(false)
    }
  }, [atLeastOneSelected, advancing, saveNow, router, locale, t])

  // ─── Styles (inline — per handoff Lesson 3) ──────────────────────────────
  const containerStyle = {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
    maxWidth: '880px',
    margin: '0 auto',
    width: '100%',
  }

  const hintBannerStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px 18px',
    backgroundColor: 'rgba(212,130,10,0.08)',
    border: '1px solid rgba(212,130,10,0.25)',
    borderRadius: '12px',
    fontFamily: 'var(--font-jost), sans-serif',
    fontSize: '14px',
    fontWeight: 400,
    color: '#5c4b2a',
    lineHeight: 1.5,
  }

  const hintIconStyle = {
    flexShrink: 0,
    width: '20px',
    height: '20px',
    color: '#d4820a',
  }

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
    gap: '16px',
  }

  // ─── Render ──────────────────────────────────────────────────────────────
  return (
    <StepFrame
      locale={locale}
      currentStepDisplayNumber={1}
      totalSteps={2}
      serviceTag={t('serviceTag')}
      heading={t('heading')}
      subHeading={t('sub')}
      backHref={null}
      canContinue={atLeastOneSelected && !hydrating}
      isSubmitting={advancing}
      continueLabel={t('continueLabel')}
      submittingLabel={t('continueSubmitting')}
      onContinue={handleContinue}
      error={pageError}
      onDismissError={() => setPageError(null)}
      savedIndicator={<SavedIndicator state={saveState} locale={locale} />}
    >
      <div style={containerStyle}>
        {/* Hint banner — "Set up all three — recommended" */}
        <div style={hintBannerStyle} role="note">
          <svg
            style={hintIconStyle}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 2 L15 8.5 L22 9.5 L17 14.5 L18.5 21.5 L12 18 L5.5 21.5 L7 14.5 L2 9.5 L9 8.5 Z" />
          </svg>
          <span>{t('hintBanner')}</span>
        </div>

        {/* Card grid */}
        <div style={gridStyle}>
          <CardChoice
            title={t('cards.reservations.title')}
            description={t('cards.reservations.description')}
            selected={flags.service_reservations_enabled}
            onClick={() => handleToggle('service_reservations_enabled')}
          />
          <CardChoice
            title={t('cards.takeaway.title')}
            description={t('cards.takeaway.description')}
            selected={flags.service_takeaway_enabled}
            onClick={() => handleToggle('service_takeaway_enabled')}
          />
          <CardChoice
            title={t('cards.qr.title')}
            description={t('cards.qr.description')}
            selected={flags.service_qr_enabled}
            onClick={() => handleToggle('service_qr_enabled')}
          />
          <CardChoice
            title={t('cards.delivery.title')}
            description={t('cards.delivery.description')}
            selected={false}
            onClick={() => {}}
            disabled
            disabledReason={t('comingSoon')}
          />
        </div>
      </div>
    </StepFrame>
  )
}
