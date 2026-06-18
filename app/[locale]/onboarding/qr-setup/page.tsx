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

// ---- TogglePill (sage when on) -----------------------------------------------

function TogglePill({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={(e) => { e.stopPropagation(); onChange(!value) }}
      style={{
        position: 'relative',
        width: '44px',
        height: '25px',
        borderRadius: '9999px',
        backgroundColor: value ? 'var(--sage)' : '#dccdb1',
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
          left: value ? '22px' : '3px',
          width: '19px',
          height: '19px',
          borderRadius: '50%',
          backgroundColor: '#fffefb',
          boxShadow: '0 1.5px 4px rgba(30, 21, 8, 0.18)',
          transition: 'left 220ms ease',
        }}
      />
    </button>
  )
}

// ---- LangDropdown (chip style with native select) ----------------------------

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

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        padding: '8px 32px 8px 14px',
        borderRadius: '11px',
        backgroundColor: 'var(--cream)',
        border: hovered ? '1.5px solid var(--amber)' : '1.5px solid var(--cream-border)',
        fontFamily: 'var(--font-jost), Jost, sans-serif',
        fontWeight: 600,
        fontSize: '12.5px',
        color: 'var(--earth)',
        cursor: 'pointer',
        flexShrink: 0,
        transition: 'border-color 200ms ease',
        whiteSpace: 'nowrap',
      }}
    >
      {options.find((o) => o.value === value)?.label ?? value}
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="var(--stone)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{
          position: 'absolute',
          right: '10px',
          top: '50%',
          transform: 'translateY(-50%)',
          pointerEvents: 'none',
        }}
      >
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
          appearance: 'none',
          WebkitAppearance: 'none',
        } as React.CSSProperties}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

// ---- IconTile ----------------------------------------------------------------

function IconTile({ bg, color, children }: { bg: string; color: string; children: ReactNode }) {
  return (
    <div style={{
      width: 40,
      height: 40,
      borderRadius: 11,
      backgroundColor: bg,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}>
      <div style={{ color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {children}
      </div>
    </div>
  )
}

// ---- SettingCard (standalone lifted card per row) ----------------------------

function SettingCard({
  iconTile,
  title,
  description,
  control,
  extra,
}: {
  iconTile: ReactNode
  title: string
  description?: string
  control: ReactNode
  extra?: ReactNode
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        alignItems: extra ? 'flex-start' : 'center',
        gap: '14px',
        backgroundColor: 'var(--cream-card)',
        borderRadius: '14px',
        padding: '16px 18px',
        boxShadow: hovered
          ? '0 2px 6px rgba(30, 21, 8, 0.05), 0 8px 20px rgba(212, 130, 10, 0.06)'
          : '0 1px 2px rgba(30, 21, 8, 0.04)',
        transition: 'box-shadow 220ms ease',
      }}
    >
      <div style={{ paddingTop: extra ? '2px' : 0 }}>{iconTile}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontWeight: 700,
          fontSize: '14px',
          lineHeight: 1.25,
          letterSpacing: '-0.005em',
          color: 'var(--earth)',
          margin: 0,
        }}>
          {title}
        </div>
        {description && (
          <div style={{
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontWeight: 400,
            fontSize: '12px',
            lineHeight: 1.45,
            color: 'var(--stone)',
            margin: '3px 0 0 0',
          }}>
            {description}
          </div>
        )}
        {extra && <div style={{ marginTop: '12px' }}>{extra}</div>}
      </div>
      <div style={{ flexShrink: 0, paddingTop: extra ? '2px' : 0 }}>{control}</div>
    </div>
  )
}

// ---- TicketCard (ticket-style plan card) ------------------------------------

function TicketCard({
  variant,
  title,
  price,
  oneTimeLabel,
  bullets,
  selected,
  locked,
  lockedBadge,
  onSelect,
}: {
  variant: 'basic' | 'premium'
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

  const isBasic = variant === 'basic'

  const cardShadow = locked
    ? 'none'
    : hovered
      ? isBasic
        ? '0 1px 2px rgba(30, 21, 8, 0.04), 0 18px 42px rgba(212, 130, 10, 0.14)'
        : '0 1px 2px rgba(30, 21, 8, 0.04), 0 18px 42px rgba(212, 130, 10, 0.24)'
      : isBasic
        ? '0 1px 2px rgba(30, 21, 8, 0.04), 0 14px 32px rgba(212, 130, 10, 0.10)'
        : '0 1px 2px rgba(30, 21, 8, 0.04), 0 14px 32px rgba(212, 130, 10, 0.18)'

  const bandBg = isBasic ? 'var(--sage)' : 'var(--amber)'
  const bandTextColor = isBasic ? 'var(--sage-bg)' : 'var(--earth)'
  const bandLabel = locked ? lockedBadge : isBasic ? 'BASIC' : 'PREMIUM · POPULAR'
  const bandCheckStroke = isBasic ? '#eef3e0' : '#1e1508'

  const perfBorder = isBasic ? 'rgba(212, 130, 10, 0.22)' : 'rgba(212, 130, 10, 0.32)'

  const checkBg = isBasic ? 'var(--sage-bg)' : 'rgba(212, 130, 10, 0.18)'
  const checkStroke = isBasic ? 'var(--sage)' : 'var(--amber)'
  const featureColor = isBasic ? '#6f6353' : 'var(--stone-dim)'

  return (
    <div
      onClick={() => !locked && onSelect()}
      onMouseEnter={() => { if (!locked) setHovered(true) }}
      onMouseLeave={() => { if (!locked) setHovered(false) }}
      style={{
        position: 'relative',
        borderRadius: '16px',
        overflow: 'hidden',
        cursor: locked ? 'not-allowed' : 'pointer',
        opacity: locked ? 0.74 : 1,
        transition: 'transform 220ms ease, box-shadow 220ms ease',
        transform: hovered && !locked ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: cardShadow,
        backgroundColor: isBasic ? 'var(--cream-card)' : 'var(--earth)',
        boxSizing: 'border-box' as const,
      }}
    >
      {/* Top band */}
      <div style={{
        padding: '9px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: bandBg,
      }}>
        <span style={{
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontWeight: 700,
          fontSize: '9.5px',
          letterSpacing: '0.16em',
          textTransform: 'uppercase' as const,
          color: bandTextColor,
        }}>
          {bandLabel}
        </span>
        {selected ? (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontWeight: 700,
            fontSize: '9.5px',
            letterSpacing: '0.14em',
            textTransform: 'uppercase' as const,
            color: bandTextColor,
          }}>
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
              <path d="M2 5.5l2.5 2.5 4.5-5" stroke={bandCheckStroke} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            SELECTED
          </span>
        ) : (
          <span aria-hidden="true" style={{ display: 'inline-block', height: '11px' }} />
        )}
      </div>

      {/* Card body */}
      <div style={{ padding: '20px 20px 22px' }}>
        {/* Title */}
        <div style={{
          fontFamily: 'var(--font-raleway), sans-serif',
          fontWeight: 900,
          fontSize: '22px',
          letterSpacing: '-0.025em',
          lineHeight: 1,
          margin: '0 0 11px 0',
          color: isBasic ? 'var(--earth)' : 'var(--cream-card)',
        }}>
          {title}
        </div>

        {/* Price block */}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span style={{
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontWeight: 700,
            fontSize: '28px',
            letterSpacing: '-0.015em',
            lineHeight: 1,
            color: 'var(--amber)',
          }}>
            {price}
          </span>
          <span style={{
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontWeight: 400,
            fontSize: '11.5px',
            color: 'var(--stone)',
          }}>
            {oneTimeLabel}
          </span>
        </div>

        {/* Perforation — dashed line with punched-out notch circles */}
        <div style={{ position: 'relative', margin: '18px -20px' }}>
          <div style={{ borderTop: `1.5px dashed ${perfBorder}` }} />
          <div
            className="notch-canvas"
            style={{
              position: 'absolute',
              width: 18,
              height: 18,
              borderRadius: '50%',
              top: -9,
              left: -9,
            }}
          />
          <div
            className="notch-canvas"
            style={{
              position: 'absolute',
              width: 18,
              height: 18,
              borderRadius: '50%',
              top: -9,
              right: -9,
            }}
          />
        </div>

        {/* Feature list */}
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '9px' }}>
          {bullets.map((b, i) => (
            <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '9px' }}>
              <div style={{
                width: 17,
                height: 17,
                borderRadius: '50%',
                backgroundColor: checkBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: '1px',
                flexShrink: 0,
              }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
                  <polyline points="20 6 9 17 4 12" stroke={checkStroke} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span style={{
                fontFamily: 'var(--font-jost), Jost, sans-serif',
                fontWeight: 400,
                fontSize: '12.5px',
                lineHeight: 1.4,
                color: featureColor,
              }}>
                {b}
              </span>
            </li>
          ))}
        </ul>
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
      showProgress={false}
      hideDefaultHeader
      currentStepDisplayNumber={currentDisplayNum}
      totalSteps={totalSteps}
      heading={t('heading')}
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
          gap: 14px;
          margin-bottom: 24px;
        }
        @media (max-width: 600px) {
          .qr-plan-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {/* ── Header band ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '36px',
        gap: '16px',
      }}>
        {/* Left: pill + title + description */}
        <div>
          {/* Step pill */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            backgroundColor: 'var(--earth)',
            color: 'var(--amber)',
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontWeight: 700,
            fontSize: '9.5px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            padding: '6px 12px',
            borderRadius: '9999px',
            marginBottom: '14px',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '9999px', backgroundColor: 'var(--amber)', flexShrink: 0 }} />
            {locale === 'en'
              ? `Step ${currentDisplayNum} of ${totalSteps} — QR`
              : `Stap ${currentDisplayNum} van ${totalSteps} — QR`}
          </div>

          {/* Title */}
          <h1 style={{
            fontFamily: 'var(--font-raleway), Raleway, sans-serif',
            fontWeight: 900,
            fontSize: '42px',
            lineHeight: 0.96,
            letterSpacing: '-0.035em',
            color: 'var(--earth)',
            margin: '0 0 10px 0',
          }}>
            {t('headingBefore')}{' '}
            <span style={{ color: 'var(--amber)' }}>{t('headingConnector')}</span>
            {' '}{t('headingAfter')}
          </h1>

          {/* Description */}
          <p style={{
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontWeight: 400,
            fontSize: '13px',
            lineHeight: 1.55,
            color: 'var(--stone)',
            maxWidth: '300px',
            margin: 0,
          }}>
            {t('sub')}
          </p>
        </div>

        {/* Right: step counter + progress dots */}
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{
            fontFamily: 'var(--font-raleway), Raleway, sans-serif',
            fontWeight: 900,
            fontSize: '32px',
            letterSpacing: '-0.02em',
            lineHeight: 1,
            color: 'var(--earth)',
          }}>
            {String(currentDisplayNum).padStart(2, '0')}
            <span style={{
              fontSize: '17px',
              color: 'var(--stone-dim)',
              letterSpacing: '-0.01em',
            }}>
              /{String(totalSteps).padStart(2, '0')}
            </span>
          </div>

          {/* Progress segments */}
          <div style={{
            display: 'flex',
            gap: '3px',
            justifyContent: 'flex-end',
            marginTop: '10px',
          }}>
            {Array.from({ length: totalSteps }, (_, i) => {
              const n = i + 1
              const isCurrent = n === currentDisplayNum
              const isDone = n < currentDisplayNum
              return (
                <div
                  key={i}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 2,
                    backgroundColor: isCurrent
                      ? 'var(--sage)'
                      : isDone
                        ? 'var(--amber)'
                        : 'var(--cream-border)',
                  }}
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Plan section label ───────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: '10px',
        marginBottom: '14px',
      }}>
        <span style={{
          fontFamily: 'var(--font-raleway), Raleway, sans-serif',
          fontWeight: 900,
          fontSize: '18px',
          letterSpacing: '-0.02em',
          color: 'var(--earth)',
        }}>
          {t('plansHeading')}
        </span>
        <span style={{
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontWeight: 400,
          fontSize: '11.5px',
          color: 'var(--stone)',
        }}>
          {t('plansSub')}
        </span>
      </div>

      {/* ── Ticket plan cards ────────────────────────────────────────────── */}
      <div className="qr-plan-grid">
        <TicketCard
          variant="basic"
          title={t('plans.basic.title')}
          price={t('plans.basic.price')}
          oneTimeLabel={t('oneTime')}
          bullets={basicBullets}
          selected={qrPlan === 'basic'}
          locked={false}
          lockedBadge=""
          onSelect={() => handlePlanSelect('basic')}
        />
        <TicketCard
          variant="premium"
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

      {/* ── Settings rows (icon-tiled standalone cards) ───────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* Auto-accept — sage tile (confirmed action) */}
        <SettingCard
          iconTile={
            <IconTile bg="var(--sage-bg)" color="var(--sage)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </IconTile>
          }
          title={t('autoAccept.label')}
          description={t('autoAccept.description')}
          control={<TogglePill value={autoAccept} onChange={handleAutoAcceptChange} />}
        />

        {/* Item notes — burgundy tile (input / customization) */}
        <SettingCard
          iconTile={
            <IconTile bg="var(--burgundy-bg)" color="var(--burgundy)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </IconTile>
          }
          title={t('itemNotes.label')}
          description={t('itemNotes.description')}
          control={<TogglePill value={itemNotesAllowed} onChange={handleItemNotesChange} />}
        />

        {/* Menu language — amber tile (global / configuration) */}
        <SettingCard
          iconTile={
            <IconTile bg="var(--amber-bg)" color="var(--amber-deep)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="2" y1="12" x2="22" y2="12" />
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
              </svg>
            </IconTile>
          }
          title={t('language.heading')}
          description={t('language.sub')}
          control={
            <LangDropdown
              value={menuLanguage}
              options={menuLanguageOptions}
              onChange={handleMenuLanguageChange}
            />
          }
        />

        {/* Accent colour — amber tile (visual / brand config) */}
        <SettingCard
          iconTile={
            <IconTile bg="var(--amber-bg)" color="var(--amber-deep)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="13.5" cy="6.5" r="0.5" fill="currentColor" />
                <circle cx="17.5" cy="10.5" r="0.5" fill="currentColor" />
                <circle cx="8.5" cy="7.5" r="0.5" fill="currentColor" />
                <circle cx="6.5" cy="12.5" r="0.5" fill="currentColor" />
                <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
              </svg>
            </IconTile>
          }
          title={t('accentColor.heading')}
          description={t('accentColor.sub')}
          control={
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
          }
          extra={
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <input
                type="text"
                value={accentHexInput}
                onChange={(e) => handleAccentHexInputChange(e.target.value)}
                placeholder="#d4820a"
                maxLength={7}
                style={{
                  width: '110px',
                  padding: '9px 12px',
                  backgroundColor: 'var(--cream)',
                  borderRadius: '8px',
                  border: accentColorError ? '1.5px solid #ef4444' : '1.5px solid rgba(30, 21, 8, 0.08)',
                  fontFamily: "'Jost', monospace, sans-serif",
                  fontSize: '13.5px',
                  color: 'var(--earth)',
                  outline: 'none',
                }}
              />
              <button
                type="button"
                onClick={() => handleAccentColorChange('#d4820a')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--stone)',
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
          }
        />
      </div>
    </StepFrame>
  )
}
