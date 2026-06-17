'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import StepFrame from '@/components/onboarding/shell/StepFrame'
import SavedIndicator from '@/components/onboarding/shell/SavedIndicator'
import type { ReactNode } from 'react'
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

// ---- TogglePill (inline) -----------------------------------------------------

function TogglePill({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={(e) => { e.stopPropagation(); onChange(!value) }}
      style={{
        position: 'relative',
        width: '46px',
        height: '26px',
        borderRadius: '9999px',
        backgroundColor: value ? '#d4820a' : '#dccdb1',
        border: 'none',
        cursor: 'pointer',
        transition: 'background-color 220ms ease',
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '3px',
          left: value ? '23px' : '3px',
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: '#fffefb',
          boxShadow: '0 2px 5px rgba(30, 21, 8, 0.15)',
          transition: 'left 220ms ease',
        }}
      />
    </button>
  )
}

// ---- LangDropdown (inline) ---------------------------------------------------

function LangDropdown({
  value,
  options,
  onChange,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const selectedLabel = options.find((o) => o.value === value)?.label ?? value

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        padding: '9px 14px 9px 16px',
        borderRadius: '11px',
        backgroundColor: hovered ? '#f5ede0' : '#fdfaf5',
        transition: 'background-color 220ms ease',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <span style={{
        fontFamily: 'var(--font-jost), Jost, sans-serif',
        fontWeight: 500,
        fontSize: '13.5px',
        color: '#1e1508',
        pointerEvents: 'none',
        whiteSpace: 'nowrap',
      }}>
        {selectedLabel}
      </span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9c8b6a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, pointerEvents: 'none' }}>
        <polyline points="6 9 12 15 18 9" />
      </svg>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          cursor: 'pointer',
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

// ---- SettingRow (inline) -----------------------------------------------------

function SettingRow({
  title,
  description,
  control,
  divider = false,
  children,
}: {
  title: string
  description?: string
  control: ReactNode
  divider?: boolean
  children?: ReactNode
}) {
  return (
    <div style={{
      padding: '22px 26px',
      borderTop: divider ? '1px solid rgba(30, 21, 8, 0.05)' : 'none',
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '22px',
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontWeight: 600,
            fontSize: '15.5px',
            lineHeight: 1.3,
            letterSpacing: '-0.005em',
            color: '#1e1508',
            margin: 0,
          }}>
            {title}
          </div>
          {description && (
            <div style={{
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontWeight: 400,
              fontSize: '13px',
              lineHeight: 1.5,
              color: '#9c8b6a',
              margin: '5px 0 0 0',
            }}>
              {description}
            </div>
          )}
        </div>
        <div style={{ flexShrink: 0 }}>{control}</div>
      </div>
      {children}
    </div>
  )
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
  const [hovered, setHovered] = useState(false)

  const cardShadow = locked
    ? 'none'
    : hovered
      ? '0 2px 4px rgba(30, 21, 8, 0.04), 0 22px 48px rgba(212, 130, 10, 0.16)'
      : '0 1px 2px rgba(30, 21, 8, 0.04), 0 16px 38px rgba(212, 130, 10, 0.12)'

  return (
    <div
      onClick={() => !locked && onSelect()}
      onMouseEnter={() => { if (!locked) setHovered(true) }}
      onMouseLeave={() => { if (!locked) setHovered(false) }}
      style={{
        position: 'relative',
        padding: '30px 28px',
        borderRadius: '18px',
        backgroundColor: locked ? '#f5f0e3' : '#fbf6ec',
        cursor: locked ? 'not-allowed' : 'pointer',
        opacity: locked ? 0.74 : 1,
        transition: 'box-shadow 280ms ease, transform 220ms ease',
        boxShadow: cardShadow,
        transform: hovered && !locked ? 'translateY(-2px)' : 'translateY(0)',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box' as const,
      }}
    >
      {/* Check chip — selected only */}
      {selected && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '22px',
            right: '22px',
            width: '22px',
            height: '22px',
            borderRadius: '50%',
            backgroundColor: '#d4820a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
            <path d="M2 5.5l2.5 2.5 4.5-5" stroke="#fdfaf5" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      )}

      {/* Locked pill */}
      {locked && lockedBadge && (
        <span style={{
          position: 'absolute',
          top: '22px',
          right: '22px',
          backgroundColor: '#d4820a',
          color: '#fdfaf5',
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontWeight: 600,
          fontSize: '10px',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.1em',
          padding: '5px 10px',
          borderRadius: '9999px',
        }}>
          {lockedBadge}
        </span>
      )}

      {/* Title */}
      <div style={{
        fontFamily: 'var(--font-raleway), sans-serif',
        fontWeight: 900,
        fontSize: '28px',
        color: '#1e1508',
        lineHeight: 1.02,
        letterSpacing: '-0.025em',
      }}>
        {title}
      </div>

      {/* Price block */}
      <div style={{ marginTop: '14px', display: 'flex', alignItems: 'baseline', gap: '8px' }}>
        <span style={{
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontWeight: 700,
          fontSize: '32px',
          lineHeight: 1,
          letterSpacing: '-0.01em',
          color: '#d4820a',
        }}>
          {price}
        </span>
        <span style={{
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontWeight: 400,
          fontSize: '14px',
          lineHeight: 1,
          color: '#9c8b6a',
        }}>
          {oneTimeLabel}
        </span>
      </div>

      {/* Features list */}
      <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '11px' }}>
        {bullets.map((b, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
              <path d="M2 7l3.5 3.5 6.5-7" stroke="#d4820a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span style={{
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontWeight: 500,
              fontSize: '13.5px',
              lineHeight: 1.4,
              color: '#1e1508',
            }}>
              {b}
            </span>
          </div>
        ))}
      </div>
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
          gap: 20px;
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

        {/* Combined settings card */}
        <div style={{
          backgroundColor: '#fbf6ec',
          borderRadius: '18px',
          boxShadow: '0 1px 2px rgba(30, 21, 8, 0.04), 0 16px 38px rgba(212, 130, 10, 0.12)',
          overflow: 'hidden',
        }}>
          <SettingRow
            title={t('autoAccept.label')}
            description={t('autoAccept.description')}
            control={<TogglePill value={autoAccept} onChange={handleAutoAcceptChange} />}
          />
          <SettingRow
            title={t('itemNotes.label')}
            description={t('itemNotes.description')}
            divider
            control={<TogglePill value={itemNotesAllowed} onChange={handleItemNotesChange} />}
          />
          <SettingRow
            title={t('language.heading')}
            description={t('language.sub')}
            divider
            control={
              <LangDropdown
                value={menuLanguage}
                options={menuLanguageOptions}
                onChange={handleMenuLanguageChange}
              />
            }
          />
          {/* Accent colour row — custom layout to fit the colour picker */}
          <div style={{ padding: '22px 26px', borderTop: '1px solid rgba(30, 21, 8, 0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '22px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: 'var(--font-jost), Jost, sans-serif',
                  fontWeight: 600,
                  fontSize: '15.5px',
                  lineHeight: 1.3,
                  letterSpacing: '-0.005em',
                  color: '#1e1508',
                  margin: 0,
                }}>
                  {t('accentColor.heading')}
                </div>
                <div style={{
                  fontFamily: 'var(--font-jost), Jost, sans-serif',
                  fontWeight: 400,
                  fontSize: '13px',
                  lineHeight: 1.5,
                  color: '#9c8b6a',
                  margin: '5px 0 0 0',
                }}>
                  {t('accentColor.sub')}
                </div>
              </div>
              {/* Colour swatch — clickable to open native colour picker */}
              <label
                htmlFor="qr-accent-color"
                style={{ cursor: 'pointer', flexShrink: 0, position: 'relative' }}
              >
                <span
                  aria-hidden
                  style={{
                    display: 'block',
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: accentColor,
                    border: '1px solid rgba(30, 21, 8, 0.08)',
                    boxShadow: 'inset 0 0 0 2px #fffefb',
                  }}
                />
                <input
                  id="qr-accent-color"
                  type="color"
                  value={accentColor}
                  onChange={(e) => handleAccentColorChange(e.target.value)}
                  style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                />
              </label>
            </div>
            {/* Hex input + reset */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '14px', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={accentHexInput}
                onChange={(e) => handleAccentHexInputChange(e.target.value)}
                placeholder="#d4820a"
                maxLength={7}
                style={{
                  width: '110px',
                  padding: '9px 12px',
                  backgroundColor: '#fdfaf5',
                  borderRadius: '8px',
                  border: accentColorError ? '1.5px solid #ef4444' : '1.5px solid rgba(30, 21, 8, 0.08)',
                  fontFamily: "'Jost', monospace, sans-serif",
                  fontSize: '13.5px',
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
              {accentColorError && (
                <span style={{
                  color: '#c64a4a',
                  fontFamily: 'var(--font-jost), Jost, sans-serif',
                  fontSize: '13px',
                }}>
                  {accentColorError}
                </span>
              )}
            </div>
          </div>
        </div>

      </div>
    </StepFrame>
  )
}
