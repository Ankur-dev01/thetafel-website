'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import StepFrame from '@/components/onboarding/shell/StepFrame'
import SavedIndicator from '@/components/onboarding/shell/SavedIndicator'
import ToggleField from '@/components/onboarding/fields/ToggleField'
import SelectField from '@/components/onboarding/fields/SelectField'
import {
  getVisibleSteps,
  getTotalWizardSteps,
  getDisplayedStepNumber,
} from '@/lib/onboarding/steps'
import { stepPath, previousStepPath } from '@/lib/onboarding/routes'
import { useDraftSave } from '@/lib/onboarding/useDraftSave'

// ---- Helpers -----------------------------------------------------------------

function parseBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v
  return fallback
}

// ---- Shared styles -----------------------------------------------------------

const sectionHeadingStyle: React.CSSProperties = {
  margin: '0 0 8px',
  fontFamily: 'var(--font-jost), Jost, sans-serif',
  fontWeight: 600,
  fontSize: '18px',
  color: '#1e1508',
}

const sectionSubStyle: React.CSSProperties = {
  margin: '0 0 20px',
  fontFamily: 'var(--font-jost), Jost, sans-serif',
  fontWeight: 400,
  fontSize: '14px',
  color: '#9c8b6a',
}

// ---- PlanCard (inline) -------------------------------------------------------

function PlanCard({
  title,
  price,
  oneTimeLabel,
  bullets,
  selected,
  locked,
  lockedBadge,
  onSelect,
}: {
  title: string
  price: string
  oneTimeLabel: string
  bullets: string[]
  selected: boolean
  locked: boolean
  lockedBadge: string
  onSelect: () => void
}) {
  return (
    <div
      onClick={() => !locked && onSelect()}
      style={{
        position: 'relative',
        padding: '24px',
        borderRadius: '12px',
        background: selected ? 'rgba(212,130,10,0.06)' : '#f8f2e6',
        border: `2px solid ${selected ? '#d4820a' : 'transparent'}`,
        cursor: locked ? 'not-allowed' : 'pointer',
        opacity: locked ? 0.55 : 1,
        transition: 'background 120ms ease, border-color 120ms ease',
      }}
    >
      {locked && (
        <span style={{
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
          {lockedBadge}
        </span>
      )}

      {selected && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '14px',
            right: '14px',
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            backgroundColor: '#d4820a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fdfaf5" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
      )}

      <div style={{
        fontFamily: 'var(--font-jost), Jost, sans-serif',
        fontWeight: 600,
        fontSize: '18px',
        color: '#1e1508',
      }}>
        {title}
      </div>

      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
        <span style={{
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontWeight: 600,
          fontSize: '16px',
          color: '#d4820a',
        }}>
          {price}
        </span>
        <span style={{
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontSize: '13px',
          color: '#9c8b6a',
        }}>
          {oneTimeLabel}
        </span>
      </div>

      <ul style={{
        marginTop: '16px',
        marginBottom: 0,
        paddingLeft: '18px',
        color: '#1e1508',
        fontFamily: 'var(--font-jost), Jost, sans-serif',
        fontSize: '14px',
        lineHeight: 1.6,
      }}>
        {bullets.map((b, i) => <li key={i}>{b}</li>)}
      </ul>
    </div>
  )
}

// ---- Page --------------------------------------------------------------------

export default function QrSetupPage() {
  const t = useTranslations('onboarding.qrSetup')
  const params = useParams()
  const locale: 'nl' | 'en' = (params?.locale as string) === 'en' ? 'en' : 'nl'
  const router = useRouter()
  const pathname = usePathname()
  const { state: saveState, save, saveNow } = useDraftSave()

  // Wizard meta
  const [totalSteps, setTotalSteps] = useState(14)
  const [visibleStepIds, setVisibleStepIds] = useState<number[]>([])
  const [currentDisplayNum, setCurrentDisplayNum] = useState(9)

  // Field state
  const [qrPlan, setQrPlan] = useState<'basic' | 'premium' | null>(null)
  const [autoAccept, setAutoAccept] = useState(true)
  const [itemNotesAllowed, setItemNotesAllowed] = useState(true)
  const [menuLanguage, setMenuLanguage] = useState<'nl' | 'en' | 'nl_en'>('nl_en')
  const [accentColor, setAccentColor] = useState('#d4820a')
  const [accentHexInput, setAccentHexInput] = useState('#d4820a')
  const [accentColorError, setAccentColorError] = useState<string | null>(null)

  const [subscriptionTier, setSubscriptionTier] = useState<'starter' | 'plus' | 'premium' | null>(null)

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
          setCurrentDisplayNum(getDisplayedStepNumber(9, visibleSteps) ?? 9)
        } catch {
          // leave defaults
        }

        const planVal = r.qr_plan
        if (planVal === 'basic' || planVal === 'premium') setQrPlan(planVal)
        else setQrPlan(null)

        setAutoAccept(parseBool(r.qr_auto_accept, true))
        setItemNotesAllowed(parseBool(r.qr_item_notes_allowed, true))

        const langVal = r.qr_menu_language
        if (langVal === 'nl' || langVal === 'en' || langVal === 'nl_en') setMenuLanguage(langVal)
        else setMenuLanguage('nl_en')

        const colorVal =
          typeof r.qr_widget_accent_color === 'string' &&
          /^#[0-9a-fA-F]{6}$/.test(r.qr_widget_accent_color)
            ? r.qr_widget_accent_color
            : '#d4820a'
        setAccentColor(colorVal)
        setAccentHexInput(colorVal)

        const tierVal = r.subscription_tier
        if (tierVal === 'starter' || tierVal === 'plus' || tierVal === 'premium') {
          setSubscriptionTier(tierVal)
        } else {
          setSubscriptionTier(null)
        }

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

  function buildQrSetupPatch() {
    return {
      qr_plan: qrPlan,
      qr_auto_accept: autoAccept,
      qr_item_notes_allowed: itemNotesAllowed,
      qr_menu_language: menuLanguage,
      qr_widget_accent_color: accentColor,
    }
  }

  // ---- Handlers --------------------------------------------------------------

  function handlePlanSelect(plan: 'basic' | 'premium') {
    if (!hydrated) return
    if (plan === 'premium' && subscriptionTier !== 'premium') return
    setQrPlan(plan)
    save({ restaurant: { ...buildQrSetupPatch(), qr_plan: plan } })
  }

  function handleAutoAcceptChange(val: boolean) {
    if (!hydrated) return
    setAutoAccept(val)
    save({ restaurant: { ...buildQrSetupPatch(), qr_auto_accept: val } })
  }

  function handleItemNotesChange(val: boolean) {
    if (!hydrated) return
    setItemNotesAllowed(val)
    save({ restaurant: { ...buildQrSetupPatch(), qr_item_notes_allowed: val } })
  }

  function handleMenuLanguageChange(val: string) {
    if (!hydrated) return
    if (val !== 'nl' && val !== 'en' && val !== 'nl_en') return
    const lang = val as 'nl' | 'en' | 'nl_en'
    setMenuLanguage(lang)
    save({ restaurant: { ...buildQrSetupPatch(), qr_menu_language: lang } })
  }

  function handleAccentColorChange(val: string) {
    if (!hydrated) return
    if (!/^#[0-9a-fA-F]{6}$/.test(val)) {
      setAccentColorError(t('accentColor.errorInvalid'))
      return
    }
    setAccentColor(val)
    setAccentHexInput(val)
    setAccentColorError(null)
    save({ restaurant: { ...buildQrSetupPatch(), qr_widget_accent_color: val } })
  }

  function handleAccentHexInputChange(val: string) {
    setAccentHexInput(val)
    if (!hydrated) return
    if (/^#[0-9a-fA-F]{6}$/.test(val)) {
      setAccentColor(val)
      setAccentColorError(null)
      save({ restaurant: { ...buildQrSetupPatch(), qr_widget_accent_color: val } })
    } else {
      setAccentColorError(t('accentColor.errorInvalid'))
    }
  }

  // ---- Continue handler ------------------------------------------------------

  async function handleContinue() {
    if (submitting || qrPlan === null) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const currIdx = visibleStepIds.indexOf(9)
      const nextStepId =
        currIdx >= 0 && currIdx < visibleStepIds.length - 1
          ? visibleStepIds[currIdx + 1]!
          : 10
      await saveNow({
        restaurant: { ...buildQrSetupPatch(), current_onboarding_step: nextStepId },
      })
      const nextPath = stepPath(nextStepId, locale)
      if (nextPath) router.push(nextPath)
    } catch {
      setSubmitError(t('saveFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  // ---- Derived ---------------------------------------------------------------

  const premiumLocked = subscriptionTier !== 'premium'
  const backHref = previousStepPath(9, visibleStepIds, locale) ?? stepPath(8, locale)

  const menuLanguageOptions = [
    { value: 'nl_en', label: t('language.nl_en') },
    { value: 'nl',    label: t('language.nl') },
    { value: 'en',    label: t('language.en') },
  ]

  const basicBullets = [
    t('plans.basic.bullet1'),
    t('plans.basic.bullet2'),
    t('plans.basic.bullet3'),
  ]
  const premiumBullets = [
    t('plans.premium.bullet1'),
    t('plans.premium.bullet2'),
    t('plans.premium.bullet3'),
    t('plans.premium.bullet4'),
    t('plans.premium.bullet5'),
  ]

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
      canContinue={qrPlan !== null}
      continueLabel={t('continue')}
      onContinue={handleContinue}
      isSubmitting={submitting}
      error={submitError}
      savedIndicator={<SavedIndicator state={saveState} locale={locale} />}
    >
      <style>{`
        .qr-plan-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        @media (max-width: 720px) {
          .qr-plan-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

        {/* Section 1 — Plan selection */}
        <section>
          <h2 style={sectionHeadingStyle}>{t('plansHeading')}</h2>
          <p style={sectionSubStyle}>{t('plansSub')}</p>
          <div className="qr-plan-grid">
            <PlanCard
              title={t('plans.basic.title')}
              price={t('plans.basic.price')}
              oneTimeLabel={t('oneTime')}
              bullets={basicBullets}
              selected={qrPlan === 'basic'}
              locked={false}
              lockedBadge=""
              onSelect={() => handlePlanSelect('basic')}
            />
            <PlanCard
              title={t('plans.premium.title')}
              price={t('plans.premium.price')}
              oneTimeLabel={t('oneTime')}
              bullets={premiumBullets}
              selected={qrPlan === 'premium'}
              locked={premiumLocked}
              lockedBadge={t('premiumLocked')}
              onSelect={() => handlePlanSelect('premium')}
            />
          </div>
        </section>

        {/* Section 2 — Auto-accept */}
        <section>
          <h2 style={sectionHeadingStyle}>{t('autoAccept.heading')}</h2>
          <ToggleField
            label={t('autoAccept.label')}
            description={t('autoAccept.description')}
            value={autoAccept}
            onChange={handleAutoAcceptChange}
          />
        </section>

        {/* Section 3 — Item notes */}
        <section>
          <h2 style={sectionHeadingStyle}>{t('itemNotes.heading')}</h2>
          <ToggleField
            label={t('itemNotes.label')}
            description={t('itemNotes.description')}
            value={itemNotesAllowed}
            onChange={handleItemNotesChange}
          />
        </section>

        {/* Section 4 — Menu language */}
        <section>
          <h2 style={sectionHeadingStyle}>{t('language.heading')}</h2>
          <p style={sectionSubStyle}>{t('language.sub')}</p>
          <SelectField
            label={t('language.label')}
            value={menuLanguage}
            onChange={handleMenuLanguageChange}
            options={menuLanguageOptions}
          />
        </section>

        {/* Section 5 — Accent colour */}
        <section>
          <h2 style={sectionHeadingStyle}>{t('accentColor.heading')}</h2>
          <p style={sectionSubStyle}>{t('accentColor.sub')}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              background: accentColor,
              flexShrink: 0,
              border: '1px solid rgba(0,0,0,0.06)',
            }} />
            <input
              type="color"
              value={accentColor}
              onChange={(e) => handleAccentColorChange(e.target.value)}
              style={{
                width: '64px',
                height: '40px',
                border: 'none',
                borderRadius: '8px',
                padding: 0,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            />
            <input
              type="text"
              value={accentHexInput}
              onChange={(e) => handleAccentHexInputChange(e.target.value)}
              placeholder="#d4820a"
              maxLength={7}
              style={{
                width: '110px',
                padding: '10px 12px',
                background: '#f8f2e6',
                borderRadius: '8px',
                border: accentColorError ? '1.5px solid #ef4444' : '1.5px solid transparent',
                fontFamily: "'Jost', monospace, sans-serif",
                fontSize: '14px',
                color: '#1e1508',
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={() => handleAccentColorChange('#d4820a')}
              style={{
                background: 'none',
                border: 'none',
                color: '#9c8b6a',
                fontFamily: 'var(--font-jost), Jost, sans-serif',
                fontSize: '13px',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: 0,
              }}
            >
              {t('accentColor.reset')}
            </button>
          </div>
          {accentColorError && (
            <p style={{
              color: '#c64a4a',
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontSize: '13px',
              marginTop: '6px',
            }}>
              {accentColorError}
            </p>
          )}
        </section>

      </div>
    </StepFrame>
  )
}
