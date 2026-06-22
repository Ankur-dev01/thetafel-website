'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
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

// ── Constants ─────────────────────────────────────────────────────────────────

const LEAD_TIME_CHIPS = [
  { val: '30', label: '30 min' },
  { val: '60', label: '1 hr' },
  { val: '120', label: '2 hr' },
  { val: '240', label: '4 hr' },
  { val: '1440', label: '1 day' },
]

const WINDOW_CHIPS = [
  { val: '14', label: '14 d' },
  { val: '30', label: '30 d' },
  { val: '60', label: '60 d' },
  { val: '90', label: '90 d' },
  { val: '365', label: '1 yr' },
]

const PARTY_MIN = 1
const PARTY_MAX = 40
const CAP_MIN = 5
const CAP_MAX = 80
const CAP_STEP = 5

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseInteger(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0) return v
  if (typeof v === 'string' && /^\d+$/.test(v)) return parseInt(v, 10)
  return fallback
}

function parseNullableInt(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === 'number' && Number.isInteger(v)) return v
  if (typeof v === 'string' && /^\d+$/.test(v)) return parseInt(v, 10)
  return null
}

function parseBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v
  return fallback
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max)
}

function snapToGrid(v: number, step: number, min: number): number {
  return Math.round((v - min) / step) * step + min
}

// ── Sub-components ────────────────────────────────────────────────────────────

function IconTile({
  bg,
  color,
  icon,
  size = 34,
}: {
  bg: string
  color: string
  icon: React.ReactNode
  size?: number
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 10,
        backgroundColor: bg,
        color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      {icon}
    </div>
  )
}

function RuleCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--cream-card)',
        border: '1px solid #ebe2cf',
        borderRadius: 20,
        padding: '22px 24px',
        boxShadow: '0 1px 2px rgba(40,30,10,0.04)',
      }}
    >
      {children}
    </div>
  )
}

function CardHeader({
  iconTile,
  title,
  description,
  right,
}: {
  iconTile: React.ReactNode
  title: string
  description: string
  right?: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 16,
      }}
    >
      {iconTile}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontWeight: 700,
            fontSize: 16,
            color: 'var(--earth)',
            marginBottom: 2,
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontWeight: 400,
            fontSize: 13,
            color: 'var(--stone)',
            lineHeight: 1.4,
          }}
        >
          {description}
        </div>
      </div>
      {right != null && (
        <div
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {right}
        </div>
      )}
    </div>
  )
}

function ChipRow({
  chips,
  value,
  onChange,
}: {
  chips: { val: string; label: string }[]
  value: string
  onChange: (val: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 9 }}>
      {chips.map((chip) => {
        const selected = chip.val === value
        return (
          <button
            key={chip.val}
            type="button"
            onClick={() => onChange(chip.val)}
            style={{
              flex: 1,
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontWeight: 700,
              fontSize: 14,
              height: 46,
              borderRadius: 13,
              border: selected
                ? '2px solid var(--amber)'
                : '1.5px solid var(--cream-border)',
              backgroundColor: selected ? '#fbf3e1' : 'var(--cream-card)',
              color: selected ? '#b07a1e' : 'var(--stone-body)',
              cursor: 'pointer',
              transition: 'all 120ms ease',
              padding: '0 6px',
              whiteSpace: 'nowrap',
            }}
          >
            {chip.label}
          </button>
        )
      })}
    </div>
  )
}

function NoLimitChip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 38,
        padding: '0 16px',
        borderRadius: 9999,
        fontFamily: 'var(--font-jost), Jost, sans-serif',
        fontWeight: 700,
        fontSize: 13,
        border: active
          ? '2px solid var(--amber)'
          : '1.5px solid var(--cream-border)',
        backgroundColor: active ? '#fbf3e1' : 'var(--cream-card)',
        color: active ? '#b07a1e' : 'var(--stone-body)',
        cursor: 'pointer',
        transition: 'all 120ms ease',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </button>
  )
}

function MinusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M5 12h14"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function InlineStepper({
  value,
  noLimit,
  onStep,
}: {
  value: number
  noLimit: boolean
  onStep: (delta: number) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        backgroundColor: noLimit ? 'var(--warm)' : '#fffdf8',
        border: '1.5px solid var(--cream-border)',
        borderRadius: 13,
        padding: 4,
      }}
    >
      <button
        type="button"
        onClick={() => onStep(-1)}
        style={{
          width: 34,
          height: 38,
          borderRadius: 9,
          background: 'transparent',
          border: 'none',
          color: '#a8997c',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <MinusIcon />
      </button>
      <div
        style={{
          width: 46,
          textAlign: 'center',
          fontFamily: 'var(--font-raleway), Raleway, sans-serif',
          fontWeight: 900,
          fontSize: 24,
          color: noLimit ? '#c2b69e' : 'var(--earth)',
          userSelect: 'none',
        }}
      >
        {noLimit ? '∞' : value}
      </div>
      <button
        type="button"
        onClick={() => onStep(1)}
        style={{
          width: 34,
          height: 38,
          borderRadius: 9,
          background: 'transparent',
          border: 'none',
          color: '#a8997c',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <PlusIcon />
      </button>
    </div>
  )
}

function ToggleSwitch({
  value,
  onChange,
}: {
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      style={{
        width: 52,
        height: 30,
        borderRadius: 9999,
        backgroundColor: value ? 'var(--sage)' : '#d9cdb6',
        border: 'none',
        cursor: 'pointer',
        position: 'relative',
        flexShrink: 0,
        transition: 'background-color 200ms ease',
        padding: 0,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: 4,
          left: value ? 26 : 4,
          width: 22,
          height: 22,
          borderRadius: '50%',
          backgroundColor: '#fff',
          boxShadow: '0 1px 3px rgba(0,0,0,0.22)',
          transition: 'left 200ms ease',
          display: 'block',
        }}
      />
    </button>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function RulesPage() {
  const t = useTranslations('onboarding.rules')
  const params = useParams()
  const locale: 'nl' | 'en' =
    (params?.locale as string) === 'en' ? 'en' : 'nl'
  const router = useRouter()
  const pathname = usePathname()
  const { state: saveState, save, saveNow } = useDraftSave()

  // Wizard meta
  const [hydrated, setHydrated] = useState(false)
  const [totalSteps, setTotalSteps] = useState(14)
  const [visibleStepIds, setVisibleStepIds] = useState<number[]>([])
  const [currentDisplayNum, setCurrentDisplayNum] = useState(4)

  // Preview
  const [restaurantName, setRestaurantName] = useState('')

  // Lead time (minutes)
  const [leadTime, setLeadTime] = useState<string>('60')

  // Booking window (days)
  const [windowDays, setWindowDays] = useState<string>('90')

  // Party size
  const [partyNoLimit, setPartyNoLimit] = useState(false)
  const [partyValue, setPartyValue] = useState(8)

  // Cap per slot
  const [capNoLimit, setCapNoLimit] = useState(true)
  const [capValue, setCapValue] = useState(20)

  // Toggles
  const [waitlist, setWaitlist] = useState(true)
  const [zonePref, setZonePref] = useState(true)

  // Submit
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // ── Hydration ──────────────────────────────────────────────────────────────

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
          setCurrentDisplayNum(getDisplayedStepNumber(4, visibleSteps) ?? 4)
        } catch {
          // leave defaults
        }

        setRestaurantName(
          String(r.display_name ?? r.trade_name ?? r.legal_name ?? '')
        )

        // min_lead_time_minutes
        const ltRaw = parseInteger(r.min_lead_time_minutes, 60)
        const ltStr = String(ltRaw)
        setLeadTime(LEAD_TIME_CHIPS.some((c) => c.val === ltStr) ? ltStr : '60')

        // booking_window_days
        const wdRaw = parseInteger(r.booking_window_days, 90)
        const wdStr = String(wdRaw)
        setWindowDays(
          WINDOW_CHIPS.some((c) => c.val === wdStr) ? wdStr : '90'
        )

        // max_party_size
        const ps = parseNullableInt(r.max_party_size)
        if (ps === null) {
          setPartyNoLimit(true)
        } else {
          setPartyNoLimit(false)
          setPartyValue(clamp(ps, PARTY_MIN, PARTY_MAX))
        }

        // max_guests_per_slot
        const mg = parseNullableInt(r.max_guests_per_slot)
        if (mg === null) {
          setCapNoLimit(true)
        } else {
          setCapNoLimit(false)
          setCapValue(
            clamp(snapToGrid(mg, CAP_STEP, CAP_MIN), CAP_MIN, CAP_MAX)
          )
        }

        setWaitlist(parseBool(r.waitlist_enabled, true))
        setZonePref(parseBool(r.guest_zone_choice_enabled, true))

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

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleLeadTime = useCallback(
    (val: string) => {
      if (!hydrated) return
      setLeadTime(val)
      save({ restaurant: { min_lead_time_minutes: parseInt(val, 10) } })
    },
    [hydrated, save]
  )

  const handleWindow = useCallback(
    (val: string) => {
      if (!hydrated) return
      setWindowDays(val)
      save({ restaurant: { booking_window_days: parseInt(val, 10) } })
    },
    [hydrated, save]
  )

  const handlePartyNoLimit = useCallback(() => {
    if (!hydrated) return
    const next = !partyNoLimit
    setPartyNoLimit(next)
    save({ restaurant: { max_party_size: next ? null : partyValue } })
  }, [hydrated, partyNoLimit, partyValue, save])

  const handlePartyStep = useCallback(
    (delta: number) => {
      if (!hydrated) return
      const next = clamp(partyValue + delta, PARTY_MIN, PARTY_MAX)
      setPartyValue(next)
      setPartyNoLimit(false)
      save({ restaurant: { max_party_size: next } })
    },
    [hydrated, partyValue, save]
  )

  const handleCapNoLimit = useCallback(() => {
    if (!hydrated) return
    const next = !capNoLimit
    setCapNoLimit(next)
    save({ restaurant: { max_guests_per_slot: next ? null : capValue } })
  }, [hydrated, capNoLimit, capValue, save])

  const handleCapStep = useCallback(
    (delta: number) => {
      if (!hydrated) return
      const next = clamp(
        snapToGrid(capValue + delta, CAP_STEP, CAP_MIN),
        CAP_MIN,
        CAP_MAX
      )
      setCapValue(next)
      setCapNoLimit(false)
      save({ restaurant: { max_guests_per_slot: next } })
    },
    [hydrated, capValue, save]
  )

  const handleWaitlist = useCallback(
    (val: boolean) => {
      if (!hydrated) return
      setWaitlist(val)
      save({ restaurant: { waitlist_enabled: val } })
    },
    [hydrated, save]
  )

  const handleZonePref = useCallback(
    (val: boolean) => {
      if (!hydrated) return
      setZonePref(val)
      save({ restaurant: { guest_zone_choice_enabled: val } })
    },
    [hydrated, save]
  )

  // ── canContinue + submit ───────────────────────────────────────────────────

  const canContinue =
    hydrated &&
    LEAD_TIME_CHIPS.some((c) => c.val === leadTime) &&
    WINDOW_CHIPS.some((c) => c.val === windowDays) &&
    !submitting

  const handleContinue = useCallback(async () => {
    if (!canContinue) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const currIdx = visibleStepIds.indexOf(4)
      const nextStepId =
        currIdx >= 0 && currIdx < visibleStepIds.length - 1
          ? visibleStepIds[currIdx + 1]!
          : 5
      const nextPath = stepPath(nextStepId, locale)
      await saveNow({
        restaurant: {
          min_lead_time_minutes: parseInt(leadTime, 10),
          booking_window_days: parseInt(windowDays, 10),
          max_party_size: partyNoLimit ? null : partyValue,
          max_guests_per_slot: capNoLimit ? null : capValue,
          waitlist_enabled: waitlist,
          guest_zone_choice_enabled: zonePref,
          current_onboarding_step: nextStepId,
        },
      })
      if (nextPath) router.push(nextPath)
    } catch {
      setSubmitError(t('saveFailed'))
    } finally {
      setSubmitting(false)
    }
  }, [
    canContinue,
    visibleStepIds,
    locale,
    saveNow,
    router,
    t,
    leadTime,
    windowDays,
    partyNoLimit,
    partyValue,
    capNoLimit,
    capValue,
    waitlist,
    zonePref,
  ])

  // ── Preview computed values ────────────────────────────────────────────────

  const previewEarliestSlot = useMemo(() => {
    const mins = parseInt(leadTime, 10) || 0
    const future = new Date(Date.now() + mins * 60 * 1000)
    const now = new Date()
    const h = String(future.getHours()).padStart(2, '0')
    const m = String(future.getMinutes()).padStart(2, '0')
    const time = `${h}:${m}`
    if (future.toDateString() === now.toDateString()) return `Today · ${time}`
    const tomorrow = new Date(now.getTime() + 86400000)
    if (future.toDateString() === tomorrow.toDateString()) return `Tomorrow · ${time}`
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return `${days[future.getDay()]} · ${time}`
  }, [leadTime])

  const previewBookingUntil = useMemo(() => {
    const days = parseInt(windowDays, 10) || 0
    const future = new Date(Date.now() + days * 86400000)
    const dNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const mNames = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ]
    return `${dNames[future.getDay()]} ${future.getDate()} ${mNames[future.getMonth()]}`
  }, [windowDays])

  // ── Routes ─────────────────────────────────────────────────────────────────

  const backHref =
    previousStepPath(4, visibleStepIds, locale) ?? stepPath(3, locale)

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <StepFrame
      locale={locale}
      showProgress={false}
      hideDefaultHeader
      currentStepDisplayNumber={currentDisplayNum}
      totalSteps={totalSteps}
      heading=""
      backHref={backHref}
      canContinue={canContinue}
      continueLabel={t('continue')}
      onContinue={handleContinue}
      isSubmitting={submitting}
      error={submitError}
      savedIndicator={<SavedIndicator state={saveState} locale={locale} />}
    >
      <style>{`
        @media (max-width: 768px) {
          .rules-grid { grid-template-columns: 1fr !important; }
          .rules-preview-sticky { position: static !important; top: auto !important; }
        }
      `}</style>

      {/* ── Header band ────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 40,
          gap: 16,
        }}
      >
        <div>
          {/* Step pill */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 7,
              backgroundColor: 'var(--earth)',
              color: 'var(--amber)',
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontWeight: 700,
              fontSize: '9.5px',
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              padding: '6px 12px',
              borderRadius: 9999,
              marginBottom: 14,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 9999,
                backgroundColor: 'var(--amber)',
                flexShrink: 0,
                display: 'inline-block',
              }}
            />
            {locale === 'en'
              ? `Step ${currentDisplayNum} of ${totalSteps} — Reservations`
              : `Stap ${currentDisplayNum} van ${totalSteps} — Reserveringen`}
          </div>

          {/* Title */}
          <h1
            style={{
              fontFamily: 'var(--font-raleway), Raleway, sans-serif',
              fontWeight: 900,
              fontSize: 42,
              lineHeight: 0.96,
              letterSpacing: '-0.035em',
              color: 'var(--earth)',
              margin: '0 0 10px 0',
            }}
          >
            {t('heading')}
            <span style={{ color: 'var(--amber)' }}>.</span>
          </h1>

          {/* Description */}
          <p
            style={{
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontWeight: 400,
              fontSize: 16,
              lineHeight: 1.5,
              color: 'var(--stone)',
              maxWidth: 520,
              margin: 0,
            }}
          >
            {locale === 'en'
              ? "Set the rules — watch the guest's booking card update as you go."
              : 'Stel de regels in — zie de boekingskaart direct bijwerken.'}
          </p>
        </div>

        {/* Counter + progress dots */}
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div
            style={{
              fontFamily: 'var(--font-raleway), Raleway, sans-serif',
              fontWeight: 900,
              fontSize: 32,
              letterSpacing: '-0.02em',
              lineHeight: 1,
              color: 'var(--earth)',
            }}
          >
            {String(currentDisplayNum).padStart(2, '0')}
            <span
              style={{
                fontSize: 17,
                color: 'var(--stone-dim)',
                letterSpacing: '-0.01em',
              }}
            >
              /{String(totalSteps).padStart(2, '0')}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              gap: 3,
              justifyContent: 'flex-end',
              marginTop: 10,
            }}
          >
            {Array.from({ length: totalSteps }, (_, i) => {
              const n = i + 1
              return (
                <div
                  key={i}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 2,
                    backgroundColor:
                      n === currentDisplayNum
                        ? 'var(--sage)'
                        : n < currentDisplayNum
                          ? 'var(--amber)'
                          : 'var(--cream-border)',
                  }}
                />
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Two-column grid ────────────────────────────────────────────────── */}
      <div
        className="rules-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 360px',
          gap: 30,
          alignItems: 'start',
        }}
      >
        {/* ── Left: rule cards ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* 3a. Minimum lead time */}
          <RuleCard>
            <CardHeader
              iconTile={
                <IconTile
                  bg="var(--burgundy-bg)"
                  color="var(--burgundy)"
                  icon={
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="8.5" />
                      <path d="M12 8v4l3 2" />
                    </svg>
                  }
                />
              }
              title={t('leadTimeLabel')}
              description={t('leadTimeHint')}
            />
            <ChipRow
              chips={LEAD_TIME_CHIPS}
              value={leadTime}
              onChange={handleLeadTime}
            />
          </RuleCard>

          {/* 3b. Booking window */}
          <RuleCard>
            <CardHeader
              iconTile={
                <IconTile
                  bg="var(--sage-bg)"
                  color="var(--sage)"
                  icon={
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
                      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
                    </svg>
                  }
                />
              }
              title={t('windowLabel')}
              description={t('windowHint')}
            />
            <ChipRow
              chips={WINDOW_CHIPS}
              value={windowDays}
              onChange={handleWindow}
            />
          </RuleCard>

          {/* 3c. Maximum party size */}
          <RuleCard>
            <CardHeader
              iconTile={
                <IconTile
                  bg="var(--sage-bg)"
                  color="var(--sage)"
                  icon={
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="9" cy="8" r="3" />
                      <path d="M3 19a6 6 0 0112 0M16 6a3 3 0 010 6M18 19a5 5 0 00-3-4.6" />
                    </svg>
                  }
                />
              }
              title={t('partySizeLabel')}
              description={t('partySizeHint')}
              right={
                <>
                  <NoLimitChip
                    active={partyNoLimit}
                    label={t('noLimit')}
                    onClick={handlePartyNoLimit}
                  />
                  <InlineStepper
                    value={partyValue}
                    noLimit={partyNoLimit}
                    onStep={handlePartyStep}
                  />
                </>
              }
            />
          </RuleCard>

          {/* 3d. Maximum guests per slot */}
          <RuleCard>
            <CardHeader
              iconTile={
                <IconTile
                  bg="var(--amber-bg)"
                  color="var(--amber-deep)"
                  icon={
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19V9l8-5 8 5v10M4 19h16M9 19v-5h6v5" />
                    </svg>
                  }
                />
              }
              title={t('maxGuestsLabel')}
              description={t('maxGuestsHint')}
              right={
                <NoLimitChip
                  active={capNoLimit}
                  label={locale === 'en' ? 'No cap' : 'Geen cap'}
                  onClick={handleCapNoLimit}
                />
              }
            />
            {/* Big stepper row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                type="button"
                onClick={() => handleCapStep(-CAP_STEP)}
                disabled={capNoLimit}
                style={{
                  width: 42,
                  height: 42,
                  border: '1.5px solid var(--cream-border)',
                  borderRadius: 12,
                  backgroundColor: '#fffdf8',
                  color: '#a8997c',
                  cursor: capNoLimit ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: capNoLimit ? 0.4 : 1,
                  flexShrink: 0,
                  transition: 'opacity 150ms ease',
                }}
              >
                <MinusIcon />
              </button>

              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: 6,
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      fontFamily:
                        'var(--font-raleway), Raleway, sans-serif',
                      fontWeight: 900,
                      fontSize: 30,
                      lineHeight: 1,
                      color: capNoLimit ? '#c2b69e' : 'var(--earth)',
                    }}
                  >
                    {capNoLimit ? '∞' : capValue}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-jost), Jost, sans-serif',
                      fontWeight: 600,
                      fontSize: 13,
                      color: 'var(--stone)',
                    }}
                  >
                    {capNoLimit
                      ? locale === 'en'
                        ? 'no cap on covers'
                        : 'geen cap op couverts'
                      : locale === 'en'
                        ? 'covers per slot'
                        : 'couverts per slot'}
                  </span>
                </div>
                <div
                  style={{
                    height: 10,
                    borderRadius: 9999,
                    backgroundColor: '#efe5d2',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      borderRadius: 9999,
                      backgroundColor: 'var(--amber)',
                      width: capNoLimit
                        ? '0%'
                        : `${(capValue / CAP_MAX) * 100}%`,
                      transition: 'width 200ms ease',
                    }}
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleCapStep(CAP_STEP)}
                disabled={capNoLimit}
                style={{
                  width: 42,
                  height: 42,
                  border: '1.5px solid var(--cream-border)',
                  borderRadius: 12,
                  backgroundColor: '#fffdf8',
                  color: '#a8997c',
                  cursor: capNoLimit ? 'default' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: capNoLimit ? 0.4 : 1,
                  flexShrink: 0,
                  transition: 'opacity 150ms ease',
                }}
              >
                <PlusIcon />
              </button>
            </div>
          </RuleCard>

          {/* 3e. Toggles card */}
          <RuleCard>
            {/* Waitlist row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                paddingBottom: 18,
                borderBottom: '1px solid #f0e8d8',
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-jost), Jost, sans-serif',
                    fontWeight: 700,
                    fontSize: 15,
                    color: 'var(--earth)',
                    marginBottom: 3,
                  }}
                >
                  {t('waitlistLabel')}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-jost), Jost, sans-serif',
                    fontWeight: 400,
                    fontSize: 13,
                    color: 'var(--stone)',
                    lineHeight: 1.4,
                  }}
                >
                  {t('waitlistDescription')}
                </div>
              </div>
              <ToggleSwitch value={waitlist} onChange={handleWaitlist} />
            </div>

            {/* Zone preference row */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                paddingTop: 18,
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: 'var(--font-jost), Jost, sans-serif',
                    fontWeight: 700,
                    fontSize: 15,
                    color: 'var(--earth)',
                    marginBottom: 3,
                  }}
                >
                  {t('zonePreferenceLabel')}
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-jost), Jost, sans-serif',
                    fontWeight: 400,
                    fontSize: 13,
                    color: 'var(--stone)',
                    lineHeight: 1.4,
                  }}
                >
                  {t('zonePreferenceDescription')}
                </div>
              </div>
              <ToggleSwitch value={zonePref} onChange={handleZonePref} />
            </div>
          </RuleCard>
        </div>

        {/* ── Right: live guest preview ───────────────────────────────────── */}
        <div>
          {/* Eyebrow */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 12,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: 'var(--sage)',
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-jost), Jost, sans-serif',
                fontWeight: 700,
                fontSize: 12,
                letterSpacing: '0.13em',
                textTransform: 'uppercase',
                color: '#9a8259',
              }}
            >
              What guests see
            </span>
          </div>

          {/* Sticky wrapper */}
          <div
            className="rules-preview-sticky"
            style={{ position: 'sticky', top: 34 }}
          >
            {/* Dark outer frame */}
            <div
              style={{
                backgroundColor: 'var(--earth)',
                borderRadius: 24,
                padding: 10,
                boxShadow: '0 18px 40px rgba(40,30,10,0.22)',
              }}
            >
              {/* Inner card */}
              <div
                style={{
                  backgroundColor: '#fffdf8',
                  borderRadius: 17,
                  overflow: 'hidden',
                }}
              >
                {/* Amber header strip */}
                <div
                  style={{
                    padding: '18px 20px 16px',
                    backgroundColor: 'var(--amber)',
                  }}
                >
                  <div
                    style={{
                      fontFamily: 'var(--font-jost), Jost, sans-serif',
                      fontWeight: 700,
                      fontSize: 11,
                      letterSpacing: '0.13em',
                      textTransform: 'uppercase',
                      color: 'var(--cream)',
                      opacity: 0.85,
                      marginBottom: 5,
                    }}
                  >
                    Reserve a table
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--font-raleway), Raleway, sans-serif',
                      fontWeight: 900,
                      fontSize: 25,
                      lineHeight: 1,
                      color: 'var(--cream)',
                    }}
                  >
                    {restaurantName || 'Your restaurant'}
                  </div>
                </div>

                {/* Card body */}
                <div style={{ padding: '18px 20px 20px' }}>

                  {/* 1. Earliest slot */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      paddingBottom: 14,
                      borderBottom: '1px solid #f0e8d8',
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        backgroundColor: 'var(--burgundy-bg)',
                        color: 'var(--burgundy)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="8.5" />
                        <path d="M12 8v4l3 2" />
                      </svg>
                    </div>
                    <div>
                      <div
                        style={{
                          fontFamily: 'var(--font-jost), Jost, sans-serif',
                          fontWeight: 700,
                          fontSize: 11,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          color: 'var(--stone)',
                          marginBottom: 2,
                        }}
                      >
                        Earliest slot
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-jost), Jost, sans-serif',
                          fontWeight: 700,
                          fontSize: 15,
                          color: 'var(--earth)',
                        }}
                      >
                        {previewEarliestSlot}
                      </div>
                    </div>
                  </div>

                  {/* 2. Booking open until */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      paddingBottom: 14,
                      borderBottom: '1px solid #f0e8d8',
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        width: 30,
                        height: 30,
                        borderRadius: 8,
                        backgroundColor: 'var(--sage-bg)',
                        color: 'var(--sage)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3.5" y="5" width="17" height="15" rx="2.5" />
                        <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" />
                      </svg>
                    </div>
                    <div>
                      <div
                        style={{
                          fontFamily: 'var(--font-jost), Jost, sans-serif',
                          fontWeight: 700,
                          fontSize: 11,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          color: 'var(--stone)',
                          marginBottom: 2,
                        }}
                      >
                        Booking open until
                      </div>
                      <div
                        style={{
                          fontFamily: 'var(--font-jost), Jost, sans-serif',
                          fontWeight: 700,
                          fontSize: 15,
                          color: 'var(--earth)',
                        }}
                      >
                        {previewBookingUntil}
                      </div>
                    </div>
                  </div>

                  {/* 3. Party size chips */}
                  <div
                    style={{
                      paddingBottom: 14,
                      borderBottom: '1px solid #f0e8d8',
                      marginBottom: 14,
                    }}
                  >
                    <div
                      style={{
                        fontFamily: 'var(--font-jost), Jost, sans-serif',
                        fontWeight: 700,
                        fontSize: 11,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: 'var(--stone)',
                        marginBottom: 8,
                      }}
                    >
                      Party size
                    </div>
                    <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {(() => {
                        const maxShown = partyNoLimit
                          ? 6
                          : Math.min(partyValue, 6)
                        const nums = Array.from(
                          { length: maxShown },
                          (_, i) => i + 1
                        )
                        const showMore = partyNoLimit || partyValue > 6
                        return (
                          <>
                            {nums.map((n) => (
                              <div
                                key={n}
                                style={{
                                  minWidth: 30,
                                  height: 30,
                                  padding: '0 8px',
                                  borderRadius: 9,
                                  backgroundColor: 'var(--cream-card)',
                                  border: '1.5px solid var(--cream-border)',
                                  fontFamily:
                                    'var(--font-jost), Jost, sans-serif',
                                  fontWeight: 700,
                                  fontSize: 13,
                                  color: 'var(--earth)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                {n}
                              </div>
                            ))}
                            {showMore && (
                              <div
                                style={{
                                  minWidth: 30,
                                  height: 30,
                                  padding: '0 8px',
                                  borderRadius: 9,
                                  backgroundColor: '#fbf3e1',
                                  border: '2px solid var(--amber)',
                                  fontFamily:
                                    'var(--font-jost), Jost, sans-serif',
                                  fontWeight: 700,
                                  fontSize: 13,
                                  color: '#b07a1e',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                {partyNoLimit ? '∞' : '7+'}
                              </div>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  </div>

                  {/* 4. Seats left this slot */}
                  <div style={{ marginBottom: 18 }}>
                    <div
                      style={{
                        fontFamily: 'var(--font-jost), Jost, sans-serif',
                        fontWeight: 700,
                        fontSize: 11,
                        letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                        color: 'var(--stone)',
                        marginBottom: 6,
                      }}
                    >
                      Seats left this slot
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-jost), Jost, sans-serif',
                        fontWeight: 700,
                        fontSize: 15,
                        color: 'var(--earth)',
                        marginBottom: 8,
                      }}
                    >
                      {capNoLimit ? 'No cap' : `${capValue} seats`}
                    </div>
                    <div
                      style={{
                        height: 9,
                        borderRadius: 9999,
                        backgroundColor: '#efe5d2',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          borderRadius: 9999,
                          backgroundColor: 'var(--amber)',
                          width: capNoLimit
                            ? '100%'
                            : `${(capValue / CAP_MAX) * 100}%`,
                          transition: 'width 200ms ease',
                        }}
                      />
                    </div>
                  </div>

                  {/* Extras row */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                    {/* Waitlist pill */}
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        padding: '9px 11px',
                        borderRadius: 11,
                        backgroundColor: waitlist
                          ? 'var(--sage-bg)'
                          : '#f4efe4',
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          flexShrink: 0,
                          backgroundColor: waitlist
                            ? 'var(--sage)'
                            : '#cbbea4',
                        }}
                      />
                      <span
                        style={{
                          fontFamily:
                            'var(--font-jost), Jost, sans-serif',
                          fontWeight: 700,
                          fontSize: 12,
                          color: waitlist ? '#5a7330' : '#a89a80',
                        }}
                      >
                        {waitlist ? 'Waitlist on' : 'Waitlist off'}
                      </span>
                    </div>

                    {/* Zone pill */}
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        padding: '9px 11px',
                        borderRadius: 11,
                        backgroundColor: zonePref
                          ? 'var(--sage-bg)'
                          : '#f4efe4',
                      }}
                    >
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          flexShrink: 0,
                          backgroundColor: zonePref
                            ? 'var(--sage)'
                            : '#cbbea4',
                        }}
                      />
                      <span
                        style={{
                          fontFamily:
                            'var(--font-jost), Jost, sans-serif',
                          fontWeight: 700,
                          fontSize: 12,
                          color: zonePref ? '#5a7330' : '#a89a80',
                        }}
                      >
                        {zonePref ? 'Zones on' : 'Zones off'}
                      </span>
                    </div>
                  </div>

                  {/* CTA button — visual only */}
                  <button
                    type="button"
                    disabled
                    style={{
                      width: '100%',
                      marginTop: 16,
                      backgroundColor: 'var(--amber)',
                      color: 'var(--cream)',
                      border: 'none',
                      padding: 14,
                      borderRadius: 13,
                      fontFamily: 'var(--font-jost), Jost, sans-serif',
                      fontWeight: 700,
                      fontSize: 14,
                      letterSpacing: '0.04em',
                      cursor: 'default',
                    }}
                  >
                    Find a table
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </StepFrame>
  )
}
