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

// ---- Types ------------------------------------------------------------------

type DayConfig = {
  enabled: boolean
  openTime: string
  closeTime: string
  tagBrunch: boolean
  tagLunch: boolean
  tagDinner: boolean
}

// ---- Module-level constants and helpers ------------------------------------

const DAY_NUMS = [1, 2, 3, 4, 5, 6, 7] as const
const DEFAULT_OPEN = '12:00'
const DEFAULT_CLOSE = '22:00'
const SLOT_OPTIONS = ['15', '30', '45', '60']
const KITCHEN_OPTIONS = ['0', '15', '30', '45', '60']
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/
const MIN_OPEN_MINS = 360   // 06:00
const MAX_CLOSE_MINS = 1410 // 23:30

function normalizeTime(t: string): string {
  const m = t.match(/^(\d{2}:\d{2})/)
  return m ? m[1]! : DEFAULT_OPEN
}

function makeDefaultDays(): Record<number, DayConfig> {
  return Object.fromEntries(
    DAY_NUMS.map((d) => [
      d,
      {
        enabled: false,
        openTime: DEFAULT_OPEN,
        closeTime: DEFAULT_CLOSE,
        tagBrunch: false,
        tagLunch: false,
        tagDinner: false,
      },
    ])
  )
}

function closesNextDay(open: string, close: string): boolean {
  return open !== '' && close !== '' && close < open
}

type AvailRow = {
  day_of_week: number
  service_scope: string
  open_time: string
  close_time: string
  closes_next_day: boolean
  is_active: boolean
  tag_brunch: boolean
  tag_lunch: boolean
  tag_dinner: boolean
}

function buildAvailabilityPayload(
  days: Record<number, DayConfig>,
  perServiceDays: Record<string, Record<number, DayConfig>>,
  useOverride: boolean,
  enabledServices: string[]
): AvailRow[] {
  const rows: AvailRow[] = []

  if (!useOverride || enabledServices.length === 0) {
    for (const d of DAY_NUMS) {
      const day = days[d]!
      if (!day.enabled) continue
      if (!TIME_RE.test(day.openTime) || !TIME_RE.test(day.closeTime)) continue
      const openN = normalizeTime(day.openTime)
      const closeN = normalizeTime(day.closeTime)
      rows.push({
        day_of_week: d,
        service_scope: 'all',
        open_time: openN,
        close_time: closeN,
        closes_next_day: closesNextDay(openN, closeN),
        is_active: true,
        tag_brunch: day.tagBrunch,
        tag_lunch: day.tagLunch,
        tag_dinner: day.tagDinner,
      })
    }
  } else {
    for (const scope of enabledServices) {
      const scopeDays = perServiceDays[scope] ?? makeDefaultDays()
      for (const d of DAY_NUMS) {
        const day = scopeDays[d]!
        if (!day.enabled) continue
        if (!TIME_RE.test(day.openTime) || !TIME_RE.test(day.closeTime)) continue
        const openN = normalizeTime(day.openTime)
        const closeN = normalizeTime(day.closeTime)
        rows.push({
          day_of_week: d,
          service_scope: scope,
          open_time: openN,
          close_time: closeN,
          closes_next_day: closesNextDay(openN, closeN),
          is_active: true,
          tag_brunch: day.tagBrunch,
          tag_lunch: day.tagLunch,
          tag_dinner: day.tagDinner,
        })
      }
    }
  }

  return rows
}

function collectTimeErrors(
  days: Record<number, DayConfig>,
  perServiceDays: Record<string, Record<number, DayConfig>>,
  useOverride: boolean,
  enabledServices: string[]
): Record<string, string> {
  const errors: Record<string, string> = {}

  function checkRow(key: string, d: DayConfig) {
    if (!d.enabled) return
    if (!d.openTime || !d.closeTime) {
      errors[key] = 'invalidTime'
    } else if (d.openTime === d.closeTime) {
      errors[key] = 'closeEqualsOpen'
    }
  }

  if (!useOverride) {
    for (const n of DAY_NUMS) checkRow(String(n), days[n]!)
  } else {
    for (const scope of enabledServices) {
      const sd = perServiceDays[scope] ?? makeDefaultDays()
      for (const n of DAY_NUMS) checkRow(`${scope}:${n}`, sd[n]!)
    }
  }

  return errors
}

function applyDayToAllDays(
  sourceDayNum: number,
  days: Record<number, DayConfig>
): Record<number, DayConfig> {
  const source = days[sourceDayNum]!
  const next = { ...days }
  for (const key of DAY_NUMS) {
    if (key === sourceDayNum) continue
    next[key] = JSON.parse(JSON.stringify(source)) as DayConfig
  }
  return next
}

// ---- Time helpers -----------------------------------------------------------

function timeToMin(t: string): number {
  const parts = t.split(':')
  return parseInt(parts[0] ?? '0', 10) * 60 + parseInt(parts[1] ?? '0', 10)
}

function minToTime(m: number): string {
  const h = Math.floor(m / 60)
  const min = m % 60
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

// Track domain: 6am (360) → 2am next day (1560) = 1200 min span
function trackPct(minutes: number): number {
  return Math.max(0, Math.min(100, ((minutes - 360) / 1200) * 100))
}

// ---- Page component --------------------------------------------------------

export default function HoursPage() {
  const t = useTranslations('onboarding.hours')
  const params = useParams()
  const locale: 'nl' | 'en' =
    (params?.locale as string) === 'en' ? 'en' : 'nl'
  const router = useRouter()
  const pathname = usePathname()
  const { state: saveState, save, saveNow } = useDraftSave()

  // Wizard meta
  const [hydrating, setHydrating] = useState(true)
  const [hydrationError, setHydrationError] = useState<string | null>(null)
  const [totalSteps, setTotalSteps] = useState(14)
  const [visibleStepIds, setVisibleStepIds] = useState<number[]>([])
  const [currentDisplayNum, setCurrentDisplayNum] = useState(3)
  const [enabledServices, setEnabledServices] = useState<string[]>([])

  // Core state
  const [days, setDays] = useState<Record<number, DayConfig>>(makeDefaultDays)
  const [perServiceDays, setPerServiceDays] = useState<
    Record<string, Record<number, DayConfig>>
  >({})
  const [slotInterval, setSlotInterval] = useState('30')
  const [kitchenOffset, setKitchenOffset] = useState('30')
  const [useOverride, setUseOverride] = useState(false)

  const [isContinuing, setIsContinuing] = useState(false)

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
          setHydrating(false)
          return
        }
        const data = await res.json()
        if (cancelled) return

        const r = data?.restaurant ?? {}
        const rows: Array<Record<string, unknown>> = data?.availability ?? []

        try {
          const visibleSteps = getVisibleSteps(
            r as Parameters<typeof getVisibleSteps>[0]
          )
          setTotalSteps(getTotalWizardSteps(visibleSteps))
          setVisibleStepIds(visibleSteps.map((s) => s.id))
          setCurrentDisplayNum(getDisplayedStepNumber(3, visibleSteps) ?? 3)
        } catch {
          // Leave defaults
        }

        const svcs: string[] = []
        if (r.service_reservations_enabled) svcs.push('reservations')
        if (r.service_takeaway_enabled) svcs.push('takeaway')
        if (r.service_qr_enabled) svcs.push('qr')
        setEnabledServices(svcs)

        if (typeof r.slot_interval_minutes === 'number') {
          setSlotInterval(String(r.slot_interval_minutes))
        }
        if (typeof r.kitchen_closes_offset_minutes === 'number') {
          setKitchenOffset(String(r.kitchen_closes_offset_minutes))
        }

        const hasPerServiceRows = rows.some(
          (row) => String(row.service_scope ?? 'all') !== 'all'
        )
        const override = hasPerServiceRows
        setUseOverride(override)

        const loadedDays = makeDefaultDays()
        const loadedPerService: Record<string, Record<number, DayConfig>> = {}

        for (const row of rows) {
          const scope = String(row.service_scope ?? 'all')
          const dayNum = Number(row.day_of_week)
          if (dayNum < 1 || dayNum > 7) continue

          const cfg: DayConfig = {
            enabled: true,
            openTime: normalizeTime(String(row.open_time ?? DEFAULT_OPEN)),
            closeTime: normalizeTime(String(row.close_time ?? DEFAULT_CLOSE)),
            tagBrunch: row.tag_brunch === true,
            tagLunch: row.tag_lunch === true,
            tagDinner: row.tag_dinner === true,
          }

          if (scope === 'all') {
            loadedDays[dayNum] = cfg
          } else {
            if (!loadedPerService[scope]) {
              loadedPerService[scope] = makeDefaultDays()
            }
            loadedPerService[scope]![dayNum] = cfg
          }
        }

        setDays(loadedDays)

        if (override && Object.keys(loadedPerService).length === 0) {
          const init: Record<string, Record<number, DayConfig>> = {}
          for (const svc of svcs) {
            init[svc] = { ...loadedDays }
          }
          setPerServiceDays(init)
        } else {
          setPerServiceDays(loadedPerService)
        }

        if (!cancelled) setHydrating(false)
      } catch {
        if (!cancelled) {
          setHydrationError(t('errors.hydrate'))
          setHydrating(false)
        }
      }
    }

    void hydrate()
    return () => {
      cancelled = true
    }
  }, [t, pathname])

  // ---- Handlers ------------------------------------------------------------

  const handleDayChange = useCallback(
    (dayNum: number, changes: Partial<DayConfig>) => {
      const nextDays = {
        ...days,
        [dayNum]: { ...days[dayNum]!, ...changes },
      }
      setDays(nextDays)
      save({
        availability: buildAvailabilityPayload(
          nextDays,
          perServiceDays,
          useOverride,
          enabledServices
        ),
      })
    },
    [days, perServiceDays, useOverride, enabledServices, save]
  )

  const handleCopyToAll = useCallback(
    (dayNum: number) => {
      const nextDays = applyDayToAllDays(dayNum, days)
      setDays(nextDays)
      save({
        availability: buildAvailabilityPayload(
          nextDays,
          perServiceDays,
          useOverride,
          enabledServices
        ),
      })
    },
    [days, perServiceDays, useOverride, enabledServices, save]
  )

  const handleSlotChange = useCallback(
    (val: string) => {
      setSlotInterval(val)
      save({ restaurant: { slot_interval_minutes: parseInt(val, 10) } })
    },
    [save]
  )

  const handleKitchenChange = useCallback(
    (val: string) => {
      setKitchenOffset(val)
      save({ restaurant: { kitchen_closes_offset_minutes: parseInt(val, 10) } })
    },
    [save]
  )

  const handleContinue = useCallback(async () => {
    if (isContinuing) return
    setIsContinuing(true)
    try {
      const currIdx = visibleStepIds.indexOf(3)
      const nextStepId =
        currIdx >= 0 && currIdx < visibleStepIds.length - 1
          ? visibleStepIds[currIdx + 1]!
          : 4
      const nextPath = stepPath(nextStepId, locale)
      await saveNow({ restaurant: { current_onboarding_step: nextStepId } })
      if (nextPath) router.push(nextPath)
    } catch {
      // Error surfaced via saveState
    } finally {
      setIsContinuing(false)
    }
  }, [isContinuing, visibleStepIds, locale, saveNow, router])

  // ---- Derived state -------------------------------------------------------

  const timeErrors = useMemo(
    () =>
      collectTimeErrors(days, perServiceDays, useOverride, enabledServices),
    [days, perServiceDays, useOverride, enabledServices]
  )

  const { totalHoursOpen, openDaysCount } = useMemo(() => {
    let totalMin = 0
    let count = 0
    for (const d of DAY_NUMS) {
      const cfg = days[d]!
      if (!cfg.enabled) continue
      count++
      const openMin = timeToMin(cfg.openTime)
      const closeMin = timeToMin(cfg.closeTime)
      if (closeMin > openMin) totalMin += closeMin - openMin
    }
    return { totalHoursOpen: Math.round(totalMin / 60), openDaysCount: count }
  }, [days])

  const hasActiveDay = Object.values(days).some((d) => d.enabled)

  const canContinue =
    hasActiveDay && Object.keys(timeErrors).length === 0 && !isContinuing

  const backHref =
    previousStepPath(3, visibleStepIds, locale) ?? stepPath(2, locale)

  const slotOptions = SLOT_OPTIONS.map((v) => ({ value: v, label: `${v} min.` }))
  const kitchenOptions = KITCHEN_OPTIONS.map((v) => ({ value: v, label: `${v} min.` }))

  const dayLabels: Record<number, string> = {
    1: t('days.mon'),
    2: t('days.tue'),
    3: t('days.wed'),
    4: t('days.thu'),
    5: t('days.fri'),
    6: t('days.sat'),
    7: t('days.sun'),
  }

  const heading = t('heading')

  // ---- Header band shared render ------------------------------------------

  const headerBand = (
    <div className="hours-header-band" style={{ marginBottom: 40 }}>
      {/* Step pill */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '5px 14px',
        borderRadius: 999,
        background: 'var(--amber-bg)',
        border: '1px solid rgba(212,130,10,0.2)',
        marginBottom: 20,
      }}>
        <span style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--amber-deep)',
        }}>
          Step {currentDisplayNum} of {totalSteps} — {heading.slice(0, -1)}
        </span>
      </div>

      {/* Title */}
      <h1 style={{
        fontFamily: 'var(--font-raleway), Raleway, sans-serif',
        fontSize: 'clamp(28px, 5vw, 38px)',
        fontWeight: 900,
        color: 'var(--earth)',
        margin: '0 0 10px',
        lineHeight: 1.1,
        letterSpacing: '-0.02em',
      }}>
        {heading.slice(0, -1)}
        <span style={{ color: 'var(--amber)' }}>{heading.slice(-1)}</span>
      </h1>

      {/* Description */}
      <p style={{
        fontFamily: 'var(--font-jost), sans-serif',
        fontSize: 15,
        color: 'var(--stone)',
        margin: '0 0 20px',
        lineHeight: 1.55,
      }}>
        {t('sub')}
      </p>

      {/* Progress segments + counter */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 4,
                width: i + 1 < currentDisplayNum ? 16 : 8,
                borderRadius: 2,
                background:
                  i + 1 < currentDisplayNum
                    ? 'var(--amber)'
                    : i + 1 === currentDisplayNum
                      ? 'var(--sage)'
                      : '#e8dcc8',
                transition: 'width 300ms, background 300ms',
              }}
            />
          ))}
        </div>
        <span style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--stone-dim)',
          letterSpacing: '0.04em',
        }}>
          {currentDisplayNum} / {totalSteps}
        </span>
      </div>
    </div>
  )

  // ---- Loading state -------------------------------------------------------

  if (hydrating) {
    return (
      <StepFrame
        locale={locale}
        hideDefaultHeader
        showProgress={false}
        heading={heading}
        currentStepDisplayNumber={currentDisplayNum}
        totalSteps={totalSteps}
        backHref={backHref}
        canContinue={false}
        continueLabel={t('continueLabel')}
        onContinue={() => {}}
        error={hydrationError}
      >
        {headerBand}
        <div style={{
          color: 'var(--stone)',
          fontFamily: 'var(--font-jost), sans-serif',
          fontSize: 14,
        }}>
          {t('loading')}
        </div>
      </StepFrame>
    )
  }

  // ---- Main render ---------------------------------------------------------

  return (
    <StepFrame
      locale={locale}
      hideDefaultHeader
      showProgress={false}
      heading={heading}
      currentStepDisplayNumber={currentDisplayNum}
      totalSteps={totalSteps}
      backHref={backHref}
      canContinue={canContinue}
      isSubmitting={isContinuing}
      continueLabel={t('continueLabel')}
      onContinue={handleContinue}
      error={null}
      savedIndicator={<SavedIndicator state={saveState} locale={locale} />}
    >
      <style>{`
        @media (max-width: 768px) {
          .tf-hour-ruler { display: none !important; }
          .hours-canvas { padding-top: 18px !important; }
          .hours-day-grid { grid-template-columns: 96px 1fr 14px 1fr !important; gap: 8px !important; padding: 12px 4px !important; }
          .timeline-track { display: none !important; }
          .copy-to-all-button { display: none !important; }
          .hours-bottom-grid { grid-template-columns: 1fr !important; gap: 18px !important; }
        }
      `}</style>

      {headerBand}

      {/* Summary strip */}
      <div style={{
        background: '#1e1508',
        color: '#f3e8d2',
        borderRadius: 18,
        padding: '20px 24px',
        marginBottom: 22,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div>
          <div style={{
            fontFamily: 'var(--font-jost), sans-serif',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.13em',
            textTransform: 'uppercase',
            color: '#b79a5e',
          }}>
            Open this week
          </div>
          <div style={{
            fontFamily: 'var(--font-raleway), Raleway, sans-serif',
            fontWeight: 900,
            fontSize: 34,
            lineHeight: 1.05,
            marginTop: 6,
            color: '#f3e8d2',
          }}>
            {totalHoursOpen} hrs
            <span style={{ color: '#7c6e55', fontSize: 18, fontWeight: 900 }}>
              {' '}/ {openDaysCount} days
            </span>
          </div>
        </div>
      </div>

      {/* Schedule canvas */}
      <div
        className="hours-canvas"
        style={{
          background: 'var(--cream-card)',
          border: '1px solid #ebe2cf',
          borderRadius: 22,
          padding: '8px 24px 18px',
          boxShadow: '0 2px 8px rgba(40,30,10,0.05)',
          marginBottom: 34,
        }}
      >
        {/* Hour ruler */}
        <div
          className="tf-hour-ruler hours-day-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: '118px 86px 14px 86px 1fr 30px',
            gap: 13,
            padding: '16px 0 8px',
          }}
        >
          <div /><div /><div /><div />
          <div style={{ position: 'relative', height: 16 }}>
            {([['6a', 0], ['9a', 15], ['12p', 30], ['3p', 45], ['6p', 60], ['9p', 75], ['12a', 90], ['2a', 100]] as [string, number][]).map(([label, pct]) => (
              <span
                key={label}
                style={{
                  position: 'absolute',
                  left: `${pct}%`,
                  transform: 'translateX(-50%)',
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontSize: 10.5,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: '#b6a684',
                  whiteSpace: 'nowrap',
                }}
              >
                {label}
              </span>
            ))}
          </div>
          <div />
        </div>

        {/* Day rows */}
        {DAY_NUMS.map((dayNum) => (
          <DayRowV2
            key={dayNum}
            dayLabel={dayLabels[dayNum] ?? String(dayNum)}
            config={days[dayNum]!}
            onChange={(changes) => handleDayChange(dayNum, changes)}
            onCopyToAll={() => handleCopyToAll(dayNum)}
          />
        ))}
      </div>

      {/* Bottom settings */}
      <div
        className="hours-bottom-grid"
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 22,
          marginBottom: 22,
        }}
      >
        <StyledSelect
          label={t('slotIntervalLabel')}
          value={slotInterval}
          onChange={handleSlotChange}
          options={slotOptions}
        />
        <StyledSelect
          label={t('kitchenClosesLabel')}
          value={kitchenOffset}
          onChange={handleKitchenChange}
          options={kitchenOptions}
          hint={t('kitchenClosesHint')}
        />
      </div>
    </StepFrame>
  )
}

// ---- DayToggle --------------------------------------------------------------

function DayToggle({
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
        position: 'relative',
        width: 42,
        height: 24,
        borderRadius: 9999,
        background: value ? 'var(--amber)' : '#d9cdb6',
        border: 'none',
        cursor: 'pointer',
        flexShrink: 0,
        padding: 0,
        transition: 'background 180ms',
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: 'white',
          top: 3,
          left: value ? 21 : 3,
          transition: 'left 180ms',
          boxShadow: '0 1px 3px rgba(0,0,0,0.25)',
        }}
      />
    </button>
  )
}

// ---- TimeStepper ------------------------------------------------------------

function TimeStepper({
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  value: string
  min: number
  max: number
  disabled?: boolean
  onChange: (value: string) => void
}) {
  const currentMin = timeToMin(value)
  const borderColor = disabled ? '#e9e1d0' : 'var(--cream-border)'

  const step = (delta: number) => {
    const next = Math.min(max, Math.max(min, currentMin + delta))
    onChange(minToTime(next))
  }

  const upDisabled = disabled || currentMin >= max
  const downDisabled = disabled || currentMin <= min

  const arrowStyle = (isDisabled: boolean): React.CSSProperties => ({
    flex: 1,
    border: 'none',
    background: 'transparent',
    color: '#a8997c',
    cursor: isDisabled ? 'default' : 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 0,
    opacity: isDisabled ? 0.35 : 1,
    transition: 'background 120ms, color 120ms',
  })

  return (
    <div style={{
      height: 42,
      display: 'flex',
      alignItems: 'stretch',
      border: `1.5px solid ${borderColor}`,
      borderRadius: 12,
      overflow: 'hidden',
      background: disabled ? '#f2ecde' : '#fffdf8',
      transition: 'background 180ms, border-color 180ms',
    }}>
      {/* Time display */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-jost), sans-serif',
        fontSize: 15,
        fontWeight: 700,
        letterSpacing: '0.02em',
        color: disabled ? '#bcad8f' : 'var(--earth)',
        userSelect: 'none',
      }}>
        {value}
      </div>
      {/* Arrow buttons */}
      <div style={{
        width: 22,
        borderLeft: `1px solid ${borderColor}`,
        display: 'flex',
        flexDirection: 'column',
      }}>
        <button
          type="button"
          disabled={upDisabled}
          onClick={() => step(30)}
          style={arrowStyle(upDisabled)}
          onMouseEnter={(e) => { if (!upDisabled) { e.currentTarget.style.background = 'var(--cream-hover)'; e.currentTarget.style.color = 'var(--earth)' } }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#a8997c' }}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden>
            <polyline points="6 15 12 9 18 15" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button
          type="button"
          disabled={downDisabled}
          onClick={() => step(-30)}
          style={{ ...arrowStyle(downDisabled), borderTop: `1px solid ${borderColor}` }}
          onMouseEnter={(e) => { if (!downDisabled) { e.currentTarget.style.background = 'var(--cream-hover)'; e.currentTarget.style.color = 'var(--earth)' } }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#a8997c' }}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" aria-hidden>
            <polyline points="6 9 12 15 18 9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
    </div>
  )
}

// ---- DayRowV2 ---------------------------------------------------------------

function DayRowV2({
  dayLabel,
  config,
  onChange,
  onCopyToAll,
}: {
  dayLabel: string
  config: DayConfig
  onChange: (changes: Partial<DayConfig>) => void
  onCopyToAll: () => void
}) {
  const [hovered, setHovered] = useState(false)

  const openMin = timeToMin(config.openTime)
  const closeMin = timeToMin(config.closeTime)

  const leftPct = trackPct(openMin)
  const widthPct = Math.max(0, trackPct(closeMin) - leftPct)

  const handleToggle = (enabled: boolean) => {
    onChange({
      enabled,
      ...(enabled
        ? {
            openTime: config.openTime || DEFAULT_OPEN,
            closeTime: config.closeTime || DEFAULT_CLOSE,
          }
        : {}),
    })
  }

  return (
    <div
      className="hours-day-grid"
      style={{
        display: 'grid',
        gridTemplateColumns: '118px 86px 14px 86px 1fr 30px',
        gap: 13,
        padding: '11px 8px',
        margin: '0 -8px',
        borderRadius: 14,
        borderTop: '1px solid #f0e8d8',
        background: hovered ? '#f9f3e7' : 'transparent',
        opacity: config.enabled ? 1 : 0.62,
        transition: 'background 150ms, opacity 150ms',
        alignItems: 'center',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Col 1: toggle + label */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <DayToggle value={config.enabled} onChange={handleToggle} />
        <span style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontSize: 15,
          fontWeight: 700,
          color: config.enabled ? 'var(--earth)' : '#a89a80',
          whiteSpace: 'nowrap',
        }}>
          {dayLabel}
        </span>
      </div>

      {/* Col 2: open time stepper */}
      <TimeStepper
        value={config.openTime}
        min={MIN_OPEN_MINS}
        max={Math.max(MIN_OPEN_MINS, closeMin - 30)}
        disabled={!config.enabled}
        onChange={(t) => onChange({ openTime: t })}
      />

      {/* Col 3: separator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-jost), sans-serif',
        fontWeight: 700,
        color: '#c2b69e',
        fontSize: 15,
      }}>
        –
      </div>

      {/* Col 4: close time stepper */}
      <TimeStepper
        value={config.closeTime}
        min={Math.min(MAX_CLOSE_MINS, openMin + 30)}
        max={MAX_CLOSE_MINS}
        disabled={!config.enabled}
        onChange={(t) => onChange({ closeTime: t })}
      />

      {/* Col 5: timeline track */}
      <div className="timeline-track" style={{
        position: 'relative',
        height: 34,
        borderRadius: 10,
        background: '#f1e9d9',
        backgroundImage: 'repeating-linear-gradient(90deg, rgba(30,21,8,0.07) 0 1px, transparent 1px 15%)',
        overflow: 'hidden',
      }}>
        {config.enabled ? (
          <div style={{
            position: 'absolute',
            top: 3,
            bottom: 3,
            left: `${leftPct}%`,
            width: `${widthPct}%`,
            borderRadius: 8,
            background: 'var(--amber)',
          }} />
        ) : (
          <div style={{
            position: 'absolute',
            left: 14,
            top: '50%',
            transform: 'translateY(-50%)',
            fontFamily: 'var(--font-jost), sans-serif',
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#bbac8e',
          }}>
            CLOSED
          </div>
        )}
      </div>

      {/* Col 6: copy button */}
      <button
        type="button"
        className="copy-to-all-button"
        title="Copy this day to all"
        onClick={onCopyToAll}
        style={{
          width: 30,
          height: 30,
          borderRadius: 9,
          border: 'none',
          background: hovered ? 'var(--cream-hover)' : 'transparent',
          color: hovered ? 'var(--amber)' : '#a8997c',
          opacity: hovered ? 1 : 0.35,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'opacity 150ms, background 150ms, color 150ms',
          flexShrink: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
          <rect x="9" y="9" width="11" height="11" rx="2" stroke="currentColor" strokeWidth="1.9" fill="none" />
          <path d="M5 15V6a2 2 0 012-2h9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" fill="none" />
        </svg>
      </button>
    </div>
  )
}

// ---- StyledSelect -----------------------------------------------------------

function StyledSelect({
  label,
  value,
  onChange,
  options,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  hint?: string
}) {
  const [focused, setFocused] = useState(false)

  return (
    <div>
      <div style={{
        fontFamily: 'var(--font-jost), sans-serif',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.13em',
        textTransform: 'uppercase',
        color: 'var(--stone)',
        marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{ position: 'relative' }}>
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{
            width: '100%',
            padding: '17px 44px 17px 17px',
            background: 'var(--cream-card)',
            border: `1.5px solid ${focused ? 'rgba(212,130,10,0.6)' : 'var(--cream-border)'}`,
            borderRadius: 14,
            fontFamily: 'var(--font-jost), sans-serif',
            fontSize: 15,
            fontWeight: 500,
            color: 'var(--earth)',
            outline: 'none',
            appearance: 'none',
            WebkitAppearance: 'none',
            cursor: 'pointer',
            boxShadow: focused ? '0 0 0 3px rgba(212,130,10,0.12)' : 'none',
            transition: 'border-color 150ms, box-shadow 150ms',
          }}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#9c8b6a"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          style={{
            position: 'absolute',
            top: '50%',
            right: 17,
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
      {hint && (
        <p style={{
          margin: '9px 2px 0',
          fontFamily: 'var(--font-jost), sans-serif',
          fontSize: 13,
          color: '#9a8e7b',
          lineHeight: 1.4,
        }}>
          {hint}
        </p>
      )}
    </div>
  )
}
