'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
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
import type { ReactNode } from 'react'

// ---- Helpers -----------------------------------------------------------------

function parseBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v
  return fallback
}

function parseNullableInt(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number' && Number.isInteger(v)) return v
  if (typeof v === 'string' && /^\d+$/.test(v)) return parseInt(v, 10)
  return null
}

// ---- Tile (inline) -----------------------------------------------------------

type TileStatus = 'active-selected' | 'active-unselected' | 'locked' | 'coming-soon'

interface TileProps {
  icon: ReactNode
  title: string
  description: string
  status: TileStatus
  badge?: string
  onClick?: () => void
  children?: ReactNode
}

function Tile({ icon, title, description, status, badge, onClick, children }: TileProps) {
  const isInteractive = status === 'active-selected' || status === 'active-unselected'
  const isDisabled = status === 'locked' || status === 'coming-soon'
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={isInteractive ? onClick : undefined}
      onMouseEnter={() => { if (isInteractive) setHovered(true) }}
      onMouseLeave={() => { if (isInteractive) setHovered(false) }}
      style={{
        position: 'relative',
        backgroundColor: status === 'active-selected'
          ? 'rgba(212,130,10,0.06)'
          : hovered && isInteractive ? '#f0e8d6' : '#f8f2e6',
        border: '2px solid',
        borderColor: status === 'active-selected' ? '#d4820a' : 'transparent',
        borderRadius: '12px',
        padding: '20px',
        minHeight: '180px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        cursor: isInteractive ? 'pointer' : 'not-allowed',
        opacity: isDisabled ? 0.55 : 1,
        transition: 'background-color 0.15s, border-color 0.15s',
        boxSizing: 'border-box',
      }}
    >
      {badge && (
        <div style={{
          position: 'absolute',
          top: '12px',
          right: '12px',
          backgroundColor: '#d4820a',
          color: '#fff',
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontWeight: 600,
          fontSize: '10px',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.04em',
          padding: '4px 10px',
          borderRadius: '999px',
        }}>
          {badge}
        </div>
      )}

      <div style={{
        width: '40px',
        height: '40px',
        backgroundColor: 'rgba(212,130,10,0.12)',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: '#d4820a',
      }}>
        {icon}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
        <div style={{
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontWeight: 600,
          fontSize: '16px',
          color: '#1e1508',
          lineHeight: 1.3,
        }}>
          {title}
        </div>
        <div style={{
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontWeight: 400,
          fontSize: '13px',
          color: '#9c8b6a',
          lineHeight: 1.5,
        }}>
          {description}
        </div>
      </div>

      {children}
    </div>
  )
}

// ---- Page --------------------------------------------------------------------

export default function NoShowsPage() {
  const t = useTranslations('onboarding.noShows')
  const params = useParams()
  const locale: 'nl' | 'en' =
    (params?.locale as string) === 'en' ? 'en' : 'nl'
  const router = useRouter()
  const pathname = usePathname()
  const { state: saveState, save, saveNow } = useDraftSave()

  // Wizard meta
  const [totalSteps, setTotalSteps] = useState(14)
  const [visibleStepIds, setVisibleStepIds] = useState<number[]>([])
  const [currentDisplayNum, setCurrentDisplayNum] = useState(5)

  // Field state
  const [mollieConnected, setMollieConnected] = useState(false)
  const [remindersEmailEnabled, setRemindersEmailEnabled] = useState(true)
  const [reconfirmationEnabled, setReconfirmationEnabled] = useState(false)
  const [prepaidEnabled, setPrepaidEnabled] = useState(false)
  const [prepaidAmountCents, setPrepaidAmountCents] = useState<number | null>(null)
  const [prepaidAmountInput, setPrepaidAmountInput] = useState('')
  const [prepaidAmountError, setPrepaidAmountError] = useState<string | null>(null)
  const [prepaidFocused, setPrepaidFocused] = useState(false)

  const [hydrated, setHydrated] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ---- Hydration -------------------------------------------------------------

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
          setCurrentDisplayNum(getDisplayedStepNumber(5, visibleSteps) ?? 5)
        } catch {
          // leave defaults
        }

        setMollieConnected(
          typeof r.mollie_organization_id === 'string' &&
            r.mollie_organization_id.length > 0
        )
        setRemindersEmailEnabled(parseBool(r.noshow_reminders_email_enabled, true))
        setReconfirmationEnabled(parseBool(r.noshow_reconfirmation_enabled, false))
        setPrepaidEnabled(parseBool(r.noshow_prepaid_enabled, false))

        const cents = parseNullableInt(r.noshow_prepaid_amount_cents)
        setPrepaidAmountCents(cents)
        setPrepaidAmountInput(cents != null ? (cents / 100).toFixed(2) : '')

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

  // ---- Build patch -----------------------------------------------------------

  function buildNoshowPatch() {
    return {
      noshow_reminders_email_enabled: remindersEmailEnabled,
      noshow_reminders_whatsapp_enabled: false,
      noshow_reconfirmation_enabled: reconfirmationEnabled,
      noshow_prepaid_enabled: prepaidEnabled,
      noshow_prepaid_amount_cents: prepaidEnabled ? prepaidAmountCents : null,
    }
  }

  // ---- Tile handlers ---------------------------------------------------------

  function handleRemindersToggle() {
    if (!hydrated) return
    const next = !remindersEmailEnabled
    setRemindersEmailEnabled(next)
    save({ restaurant: { ...buildNoshowPatch(), noshow_reminders_email_enabled: next } })
  }

  function handleReconfirmationToggle() {
    if (!hydrated) return
    const next = !reconfirmationEnabled
    setReconfirmationEnabled(next)
    save({ restaurant: { ...buildNoshowPatch(), noshow_reconfirmation_enabled: next } })
  }

  function handlePrepaidToggle() {
    if (!hydrated || !mollieConnected) return
    const next = !prepaidEnabled
    setPrepaidEnabled(next)
    save({ restaurant: { ...buildNoshowPatch(), noshow_prepaid_enabled: next } })
  }

  // ---- Prepaid amount input --------------------------------------------------

  function handlePrepaidAmountChange(value: string) {
    setPrepaidAmountInput(value)
    const euros = parseFloat(value)
    if (isNaN(euros)) {
      setPrepaidAmountError(t('prepaid.amountErrorRange'))
      return
    }
    const cents = Math.round(euros * 100)
    if (cents < 100 || cents > 50000) {
      setPrepaidAmountCents(null)
      setPrepaidAmountError(t('prepaid.amountErrorRange'))
    } else {
      setPrepaidAmountCents(cents)
      setPrepaidAmountError(null)
      save({ restaurant: { ...buildNoshowPatch(), noshow_prepaid_amount_cents: cents } })
    }
  }

  // ---- Derived ---------------------------------------------------------------

  const prepaidStatus: TileStatus = !mollieConnected
    ? 'locked'
    : prepaidEnabled
      ? 'active-selected'
      : 'active-unselected'

  const backHref = previousStepPath(5, visibleStepIds, locale) ?? stepPath(4, locale)

  // ---- Continue handler ------------------------------------------------------

  async function handleContinue() {
    if (submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const currIdx = visibleStepIds.indexOf(5)
      const nextStepId =
        currIdx >= 0 && currIdx < visibleStepIds.length - 1
          ? visibleStepIds[currIdx + 1]!
          : 6
      await saveNow({
        restaurant: { ...buildNoshowPatch(), current_onboarding_step: nextStepId },
      })
      const nextPath = stepPath(nextStepId, locale)
      if (nextPath) router.push(nextPath)
    } catch {
      setSubmitError(t('saveFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  // ---- Render ----------------------------------------------------------------

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
      canContinue={true}
      continueLabel={t('continue')}
      onContinue={handleContinue}
      isSubmitting={submitting}
      error={submitError}
      savedIndicator={<SavedIndicator state={saveState} locale={locale} />}
    >
      <style>{`
        .noshow-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 16px;
        }
        @media (max-width: 720px) {
          .noshow-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Per-message cost note */}
        <p style={{
          margin: 0,
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontSize: '12px',
          fontWeight: 400,
          color: '#9c8b6a',
          lineHeight: 1.5,
        }}>
          {t('costNote')}
        </p>

        {/* Tile grid */}
        <div className="noshow-grid">
          {/* 1 — Reminders */}
          <Tile
            status={remindersEmailEnabled ? 'active-selected' : 'active-unselected'}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            }
            title={t('reminders.title')}
            description={t('reminders.description')}
            onClick={handleRemindersToggle}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
              {/* Email sub-row — checkbox visual mirrors tile state, not independently toggleable */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {remindersEmailEnabled ? (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect width="16" height="16" rx="3" fill="#d4820a" />
                    <path d="M4 8l3 3 5-5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="0.5" y="0.5" width="15" height="15" rx="2.5" stroke="#9c8b6a" />
                  </svg>
                )}
                <span style={{
                  fontFamily: 'var(--font-jost), Jost, sans-serif',
                  fontSize: '12px',
                  fontWeight: 400,
                  color: '#9c8b6a',
                }}>
                  {t('reminders.emailLabel')}
                </span>
              </div>

              {/* WhatsApp sub-row — lock icon, not clickable, always present */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#9c8b6a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="7" width="10" height="7" rx="1" />
                  <path d="M5 7V5a3 3 0 0 1 6 0v2" />
                </svg>
                <span style={{
                  fontFamily: 'var(--font-jost), Jost, sans-serif',
                  fontSize: '12px',
                  fontWeight: 400,
                  color: '#9c8b6a',
                }}>
                  {t('reminders.whatsappLabel')}
                </span>
              </div>
            </div>
          </Tile>

          {/* 2 — Reconfirmation */}
          <Tile
            status={reconfirmationEnabled ? 'active-selected' : 'active-unselected'}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                <path d="m9 12 2 2 4-4" />
              </svg>
            }
            title={t('reconfirmation.title')}
            description={t('reconfirmation.description')}
            onClick={handleReconfirmationToggle}
          />

          {/* 3 — Prepaid */}
          <Tile
            status={prepaidStatus}
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M14.5 8a4 4 0 1 0 0 8" />
                <path d="M7 11h6" />
                <path d="M7 14h6" />
              </svg>
            }
            title={t('prepaid.title')}
            description={t('prepaid.description')}
            badge={prepaidStatus === 'locked' ? t('prepaid.lockedBadge') : undefined}
            onClick={handlePrepaidToggle}
          />

          {/* 4 — Credit-card guarantee */}
          <Tile
            status="coming-soon"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="14" x="2" y="5" rx="2" />
                <line x1="2" x2="22" y1="10" y2="10" />
              </svg>
            }
            title={t('ccGuarantee.title')}
            description={t('ccGuarantee.description')}
            badge={t('comingSoonBadge')}
          />

          {/* 5 — AI no-show predictor */}
          <Tile
            status="coming-soon"
            icon={
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v18" />
                <path d="M3 12h18" />
                <path d="m5.5 5.5 13 13" />
                <path d="m5.5 18.5 13-13" />
              </svg>
            }
            title={t('aiPredictor.title')}
            description={t('aiPredictor.description')}
            badge={t('comingSoonBadge')}
          />

          {/* 6th cell intentionally empty */}
          <div aria-hidden="true" />
        </div>

        {/* Prepaid amount input — renders when prepaidEnabled, Mollie not yet connected so
            this is unreachable during onboarding; logic is forward-compatible for settings */}
        {prepaidEnabled && (
          <div>
            <label style={{
              display: 'block',
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontSize: '14px',
              fontWeight: 600,
              color: '#1e1508',
              marginBottom: '8px',
            }}>
              {t('prepaid.amountLabel')}
            </label>
            <input
              type="number"
              min={1}
              max={500}
              step={0.5}
              inputMode="decimal"
              lang="nl-NL"
              value={prepaidAmountInput}
              placeholder={t('prepaid.amountPlaceholder')}
              onFocus={() => setPrepaidFocused(true)}
              onBlur={() => setPrepaidFocused(false)}
              onChange={(e) => handlePrepaidAmountChange(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 18px',
                backgroundColor: prepaidAmountError ? '#fef2f2' : '#f8f2e6',
                border: '1.5px solid',
                borderColor: prepaidAmountError
                  ? '#ef4444'
                  : prepaidFocused
                    ? 'rgba(212,130,10,0.5)'
                    : 'transparent',
                borderRadius: '12px',
                fontFamily: 'var(--font-jost), Jost, sans-serif',
                fontSize: '15px',
                fontWeight: 400,
                color: '#1e1508',
                outline: 'none',
                transition: 'all 0.2s',
                boxSizing: 'border-box' as const,
                boxShadow:
                  prepaidFocused && !prepaidAmountError
                    ? '0 0 0 4px rgba(212,130,10,0.08)'
                    : 'none',
              }}
            />
            {prepaidAmountError && (
              <p style={{
                margin: '6px 2px 0',
                fontFamily: 'var(--font-jost), Jost, sans-serif',
                fontSize: '13px',
                fontWeight: 400,
                color: '#ef4444',
                lineHeight: 1.4,
              }}>
                {prepaidAmountError}
              </p>
            )}
            <p style={{
              margin: '10px 2px 0',
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontSize: '13px',
              fontWeight: 400,
              color: '#6b5b3f',
              lineHeight: 1.5,
            }}>
              {t('prepaid.depositDisclosureNote')}
            </p>
          </div>
        )}
      </div>
    </StepFrame>
  )
}
