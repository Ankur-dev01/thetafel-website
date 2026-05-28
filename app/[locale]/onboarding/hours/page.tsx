'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import StepFrame from '@/components/onboarding/shell/StepFrame'
import SavedIndicator from '@/components/onboarding/shell/SavedIndicator'
import SelectField from '@/components/onboarding/fields/SelectField'
import ToggleField from '@/components/onboarding/fields/ToggleField'
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
const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DEFAULT_OPEN = '12:00'
const DEFAULT_CLOSE = '22:00'
const SLOT_OPTIONS = ['15', '30', '45', '60']
const KITCHEN_OPTIONS = ['0', '15', '30', '45', '60']

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

// close < open means the closing time is on the next calendar day
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
      rows.push({
        day_of_week: d,
        service_scope: 'all',
        open_time: day.openTime,
        close_time: day.closeTime,
        closes_next_day: closesNextDay(day.openTime, day.closeTime),
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
        rows.push({
          day_of_week: d,
          service_scope: scope,
          open_time: day.openTime,
          close_time: day.closeTime,
          closes_next_day: closesNextDay(day.openTime, day.closeTime),
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

// Returns a map of errorKey → errorCode ('invalidTime' | 'closeEqualsOpen')
// Key format: '${dayNum}' for shared, '${scope}:${dayNum}' for per-service.
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

// ---- Page component --------------------------------------------------------

export default function HoursPage() {
  const t = useTranslations('onboarding.hours')
  const params = useParams()
  const locale: 'nl' | 'en' =
    (params?.locale as string) === 'en' ? 'en' : 'nl'
  const router = useRouter()
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

        // Wizard meta
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

        // Enabled services
        const svcs: string[] = []
        if (r.service_reservations_enabled) svcs.push('reservations')
        if (r.service_takeaway_enabled) svcs.push('takeaway')
        if (r.service_qr_enabled) svcs.push('qr')
        setEnabledServices(svcs)

        // Restaurant settings
        if (typeof r.slot_interval_minutes === 'number') {
          setSlotInterval(String(r.slot_interval_minutes))
        }
        if (typeof r.kitchen_closes_offset_minutes === 'number') {
          setKitchenOffset(String(r.kitchen_closes_offset_minutes))
        }
        const override = r.hours_per_service_override === true
        setUseOverride(override)

        // Build day configs from availability rows
        const loadedDays = makeDefaultDays()
        const loadedPerService: Record<string, Record<number, DayConfig>> = {}

        for (const row of rows) {
          const scope = String(row.service_scope ?? 'all')
          const dayNum = Number(row.day_of_week)
          if (dayNum < 1 || dayNum > 7) continue

          const cfg: DayConfig = {
            enabled: true,
            openTime: String(row.open_time ?? DEFAULT_OPEN),
            closeTime: String(row.close_time ?? DEFAULT_CLOSE),
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

        // If override on but no per-service rows yet, copy shared days to each service
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
  }, [t])

  // ---- Shared day handlers -------------------------------------------------

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

  // ---- Per-service day handlers -------------------------------------------

  const handleServiceDayChange = useCallback(
    (scope: string, dayNum: number, changes: Partial<DayConfig>) => {
      const existing = perServiceDays[scope] ?? makeDefaultDays()
      const nextScope = {
        ...existing,
        [dayNum]: { ...existing[dayNum]!, ...changes },
      }
      const nextPerService = { ...perServiceDays, [scope]: nextScope }
      setPerServiceDays(nextPerService)
      save({
        availability: buildAvailabilityPayload(
          days,
          nextPerService,
          useOverride,
          enabledServices
        ),
      })
    },
    [days, perServiceDays, useOverride, enabledServices, save]
  )

  // ---- Restaurant settings handlers ----------------------------------------

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

  // ---- Override toggle -----------------------------------------------------

  const handleOverrideToggle = useCallback(
    (newValue: boolean) => {
      setUseOverride(newValue)

      let nextPerService = perServiceDays
      if (newValue && Object.keys(perServiceDays).length === 0) {
        // First activation: copy shared days into every service
        nextPerService = {}
        for (const svc of enabledServices) {
          nextPerService[svc] = Object.fromEntries(
            DAY_NUMS.map((d) => [d, { ...days[d]! }])
          )
        }
        setPerServiceDays(nextPerService)
      }

      save({
        availability: buildAvailabilityPayload(
          days,
          nextPerService,
          newValue,
          enabledServices
        ),
        restaurant: { hours_per_service_override: newValue },
      })
    },
    [days, perServiceDays, enabledServices, save]
  )

  // ---- Continue ------------------------------------------------------------

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

  const payload = useMemo(
    () =>
      buildAvailabilityPayload(days, perServiceDays, useOverride, enabledServices),
    [days, perServiceDays, useOverride, enabledServices]
  )

  const canContinue =
    payload.length > 0 &&
    Object.keys(timeErrors).length === 0 &&
    !isContinuing

  const backHref =
    previousStepPath(3, visibleStepIds, locale) ?? stepPath(2, locale)

  const slotOptions = SLOT_OPTIONS.map((v) => ({
    value: v,
    label: `${v} min.`,
  }))

  const kitchenOptions = KITCHEN_OPTIONS.map((v) => ({
    value: v,
    label: `${v} min.`,
  }))

  const dayLabels: Record<number, string> = {
    1: t('days.mon'),
    2: t('days.tue'),
    3: t('days.wed'),
    4: t('days.thu'),
    5: t('days.fri'),
    6: t('days.sat'),
    7: t('days.sun'),
  }

  const serviceLabelMap: Record<string, string> = {
    reservations: t('serviceReservations'),
    takeaway: t('serviceTakeaway'),
    qr: t('serviceQr'),
  }

  // ---- Loading state -------------------------------------------------------

  if (hydrating) {
    return (
      <StepFrame
        locale={locale}
        currentStepDisplayNumber={currentDisplayNum}
        totalSteps={totalSteps}
        serviceTag={t('serviceTag')}
        heading={t('heading')}
        subHeading={t('sub')}
        backHref={backHref}
        canContinue={false}
        continueLabel={t('continueLabel')}
        onContinue={() => {}}
        error={hydrationError}
      >
        <div
          style={{
            color: 'var(--stone)',
            fontFamily: 'var(--font-jost), sans-serif',
            fontSize: '14px',
          }}
        >
          {t('loading')}
        </div>
      </StepFrame>
    )
  }

  // ---- Main render ---------------------------------------------------------

  return (
    <StepFrame
      locale={locale}
      currentStepDisplayNumber={currentDisplayNum}
      totalSteps={totalSteps}
      serviceTag={t('serviceTag')}
      heading={t('heading')}
      subHeading={t('sub')}
      backHref={backHref}
      canContinue={canContinue}
      isSubmitting={isContinuing}
      continueLabel={t('continueLabel')}
      onContinue={handleContinue}
      error={null}
      savedIndicator={<SavedIndicator state={saveState} locale={locale} />}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '32px',
          maxWidth: '720px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* Shared day-rows (override off) */}
        {!useOverride && (
          <DayBlock
            title={null}
            days={days}
            dayLabels={dayLabels}
            errorPrefix=""
            timeErrors={timeErrors}
            t={t}
            onChange={(dayNum, changes) => handleDayChange(dayNum, changes)}
          />
        )}

        {/* Per-service day blocks (override on) */}
        {useOverride && (
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
          >
            {enabledServices.map((scope) => (
              <DayBlock
                key={scope}
                title={serviceLabelMap[scope] ?? scope}
                days={perServiceDays[scope] ?? makeDefaultDays()}
                dayLabels={dayLabels}
                errorPrefix={`${scope}:`}
                timeErrors={timeErrors}
                t={t}
                onChange={(dayNum, changes) =>
                  handleServiceDayChange(scope, dayNum, changes)
                }
              />
            ))}
          </div>
        )}

        {/* Slot interval */}
        <SelectField
          label={t('slotIntervalLabel')}
          value={slotInterval}
          onChange={handleSlotChange}
          options={slotOptions}
        />

        {/* Kitchen closes */}
        <SelectField
          label={t('kitchenClosesLabel')}
          hint={t('kitchenClosesHint')}
          value={kitchenOffset}
          onChange={handleKitchenChange}
          options={kitchenOptions}
        />

        {/* Per-service override — only show when ≥2 services active */}
        {enabledServices.length >= 2 && (
          <ToggleField
            label={t('perServiceLabel')}
            description={t('perServiceHint')}
            value={useOverride}
            onChange={handleOverrideToggle}
          />
        )}
      </div>
    </StepFrame>
  )
}

// ---- DayBlock sub-component ------------------------------------------------

type DayBlockProps = {
  title: string | null
  days: Record<number, DayConfig>
  dayLabels: Record<number, string>
  errorPrefix: string
  timeErrors: Record<string, string>
  t: ReturnType<typeof useTranslations<'onboarding.hours'>>
  onChange: (dayNum: number, changes: Partial<DayConfig>) => void
}

function DayBlock({
  title,
  days,
  dayLabels,
  errorPrefix,
  timeErrors,
  t,
  onChange,
}: DayBlockProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--warm)',
        borderRadius: '16px',
        border: '1px solid rgba(156,139,106,0.2)',
        overflow: 'hidden',
      }}
    >
      {title && (
        <div
          style={{
            padding: '12px 20px',
            backgroundColor: 'rgba(212,130,10,0.07)',
            borderBottom: '1px solid rgba(156,139,106,0.12)',
            fontFamily: 'var(--font-jost), sans-serif',
            fontSize: '12px',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--amber)',
          }}
        >
          {title}
        </div>
      )}

      {DAY_NUMS.map((dayNum, i) => {
        const cfg = days[dayNum]!
        const errKey = `${errorPrefix}${dayNum}`
        const err = timeErrors[errKey]
        const isLast = i === DAY_NUMS.length - 1

        return (
          <DayRow
            key={dayNum}
            dayLabel={dayLabels[dayNum] ?? String(dayNum)}
            config={cfg}
            error={err}
            t={t}
            borderBottom={!isLast}
            onToggle={(enabled) => onChange(dayNum, { enabled })}
            onOpenChange={(openTime) => onChange(dayNum, { openTime })}
            onCloseChange={(closeTime) => onChange(dayNum, { closeTime })}
            onTagToggle={(tag) => {
              if (tag === 'brunch') onChange(dayNum, { tagBrunch: !cfg.tagBrunch })
              if (tag === 'lunch') onChange(dayNum, { tagLunch: !cfg.tagLunch })
              if (tag === 'dinner') onChange(dayNum, { tagDinner: !cfg.tagDinner })
            }}
          />
        )
      })}
    </div>
  )
}

// ---- DayRow sub-component --------------------------------------------------

type DayRowProps = {
  dayLabel: string
  config: DayConfig
  error?: string
  t: ReturnType<typeof useTranslations<'onboarding.hours'>>
  borderBottom: boolean
  onToggle: (enabled: boolean) => void
  onOpenChange: (time: string) => void
  onCloseChange: (time: string) => void
  onTagToggle: (tag: 'brunch' | 'lunch' | 'dinner') => void
}

function DayRow({
  dayLabel,
  config,
  error,
  t,
  borderBottom,
  onToggle,
  onOpenChange,
  onCloseChange,
  onTagToggle,
}: DayRowProps) {
  const showNextDay =
    config.enabled && closesNextDay(config.openTime, config.closeTime)

  const timeInputStyle = (hasErr: boolean): React.CSSProperties => ({
    padding: '7px 10px',
    borderRadius: '8px',
    border: `1.5px solid ${hasErr ? '#ef4444' : 'rgba(156,139,106,0.3)'}`,
    backgroundColor: config.enabled ? '#fdfaf5' : 'rgba(156,139,106,0.06)',
    fontFamily: 'var(--font-jost), sans-serif',
    fontSize: '14px',
    color: config.enabled ? 'var(--earth)' : 'var(--stone)',
    outline: 'none',
    width: '96px',
    cursor: config.enabled ? 'text' : 'not-allowed',
    opacity: config.enabled ? 1 : 0.6,
  })

  return (
    <div
      style={{
        padding: '12px 20px',
        borderBottom: borderBottom ? '1px solid rgba(156,139,106,0.1)' : 'none',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        {/* Day label */}
        <span
          style={{
            width: '28px',
            fontFamily: 'var(--font-jost), sans-serif',
            fontSize: '13px',
            fontWeight: 700,
            color: config.enabled ? 'var(--earth)' : 'var(--stone)',
            flexShrink: 0,
          }}
        >
          {dayLabel}
        </span>

        {/* Inline toggle */}
        <InlineToggle value={config.enabled} onChange={onToggle} />

        {/* Time inputs */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexShrink: 0,
          }}
        >
          <input
            type="time"
            value={config.openTime}
            onChange={(e) => onOpenChange(e.target.value)}
            disabled={!config.enabled}
            aria-label={t('openLabel')}
            style={timeInputStyle(!!error && config.enabled)}
          />
          <span
            style={{
              color: 'var(--stone)',
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: '14px',
            }}
          >
            –
          </span>
          <input
            type="time"
            value={config.closeTime}
            onChange={(e) => onCloseChange(e.target.value)}
            disabled={!config.enabled}
            aria-label={t('closeLabel')}
            style={timeInputStyle(!!error && config.enabled)}
          />
          {showNextDay && (
            <span
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--amber)',
                letterSpacing: '0.05em',
              }}
            >
              {t('closesNextDay')}
            </span>
          )}
        </div>

        {/* Service tag pills */}
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          <TagPill
            label={t('tagBrunch')}
            active={config.tagBrunch}
            disabled={!config.enabled}
            onClick={() => onTagToggle('brunch')}
          />
          <TagPill
            label={t('tagLunch')}
            active={config.tagLunch}
            disabled={!config.enabled}
            onClick={() => onTagToggle('lunch')}
          />
          <TagPill
            label={t('tagDinner')}
            active={config.tagDinner}
            disabled={!config.enabled}
            onClick={() => onTagToggle('dinner')}
          />
        </div>
      </div>

      {/* Inline error for this row */}
      {error && config.enabled && (
        <div
          style={{
            marginTop: '6px',
            fontFamily: 'var(--font-jost), sans-serif',
            fontSize: '12px',
            color: '#ef4444',
          }}
        >
          {t(`errors.${error as 'invalidTime' | 'closeEqualsOpen'}`)}
        </div>
      )}
    </div>
  )
}

// ---- InlineToggle sub-component --------------------------------------------

function InlineToggle({
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
        width: '40px',
        height: '22px',
        borderRadius: '999px',
        background: value ? '#d4820a' : '#c8b89a',
        border: 'none',
        cursor: 'pointer',
        transition: 'background 0.2s',
        flexShrink: 0,
        padding: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          top: '2px',
          left: value ? '20px' : '2px',
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          background: '#fdfaf5',
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
        }}
      />
    </button>
  )
}

// ---- TagPill sub-component -------------------------------------------------

function TagPill({
  label,
  active,
  disabled,
  onClick,
}: {
  label: string
  active: boolean
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: '4px 10px',
        borderRadius: '999px',
        border: '1px solid',
        borderColor: active
          ? 'var(--amber)'
          : 'rgba(156,139,106,0.3)',
        backgroundColor: active
          ? 'rgba(212,130,10,0.12)'
          : 'transparent',
        color: active ? 'var(--amber)' : 'var(--stone)',
        fontFamily: 'var(--font-jost), sans-serif',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.06em',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.45 : 1,
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )
}
