'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter, usePathname } from 'next/navigation'
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

// ---- Constants ---------------------------------------------------------------

const PREP_TIME_PRESETS = ['10', '15', '20', '25', '30', '45', '60']
const SLOT_INTERVAL_PRESETS = ['10', '15', '20', '30']

// ---- Helpers -----------------------------------------------------------------

function parseInteger(v: unknown, fallback: number): number {
  if (typeof v === 'number' && Number.isInteger(v) && v >= 0) return v
  if (typeof v === 'string' && /^\d+$/.test(v)) return parseInt(v, 10)
  return fallback
}

function parseBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === 'boolean') return v
  return fallback
}

// ---- Page --------------------------------------------------------------------

export default function OrderingPage() {
  const t = useTranslations('onboarding.ordering')
  const params = useParams()
  const locale: 'nl' | 'en' = (params?.locale as string) === 'en' ? 'en' : 'nl'
  const router = useRouter()
  const pathname = usePathname()
  const { state: saveState, save, saveNow } = useDraftSave()

  // Wizard meta
  const [totalSteps, setTotalSteps] = useState(14)
  const [visibleStepIds, setVisibleStepIds] = useState<number[]>([])
  const [currentDisplayNum, setCurrentDisplayNum] = useState(7)

  // Field state
  const [prepTime, setPrepTime] = useState<string>('20')
  const [minOrderInput, setMinOrderInput] = useState<string>('0')
  const [minOrderError, setMinOrderError] = useState<string | null>(null)
  const [minOrderFocused, setMinOrderFocused] = useState(false)
  const [slotInterval, setSlotInterval] = useState<string>('15')
  const [acceptingOrders, setAcceptingOrders] = useState<boolean>(true)
  const [itemNotesAllowed, setItemNotesAllowed] = useState<boolean>(true)
  const [scheduledOrdersAllowed, setScheduledOrdersAllowed] = useState<boolean>(false)

  const [hydrated, setHydrated] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState<boolean>(false)
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
          setCurrentDisplayNum(getDisplayedStepNumber(7, visibleSteps) ?? 7)
        } catch {
          // leave defaults
        }

        const pt = String(parseInteger(r.takeaway_prep_time_minutes, 20))
        setPrepTime(PREP_TIME_PRESETS.includes(pt) ? pt : '20')

        const cents = parseInteger(r.takeaway_min_order_cents, 0)
        setMinOrderInput(cents > 0 ? (cents / 100).toFixed(2) : '0')

        const si = String(parseInteger(r.takeaway_slot_interval_minutes, 15))
        setSlotInterval(SLOT_INTERVAL_PRESETS.includes(si) ? si : '15')

        setAcceptingOrders(parseBool(r.takeaway_accepting_orders, true))
        setItemNotesAllowed(parseBool(r.takeaway_item_notes_allowed, true))
        setScheduledOrdersAllowed(parseBool(r.takeaway_scheduled_orders_allowed, false))

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

  function buildOrderingPatch() {
    const parsedEuros = parseFloat(minOrderInput)
    const cents =
      !isNaN(parsedEuros) && parsedEuros >= 0
        ? Math.round(parsedEuros * 100)
        : 0
    return {
      takeaway_prep_time_minutes: parseInt(prepTime, 10),
      takeaway_min_order_cents: cents >= 0 && cents <= 50000 ? cents : 0,
      takeaway_slot_interval_minutes: parseInt(slotInterval, 10),
      takeaway_accepting_orders: acceptingOrders,
      takeaway_item_notes_allowed: itemNotesAllowed,
      takeaway_scheduled_orders_allowed: scheduledOrdersAllowed,
    }
  }

  // ---- Handlers --------------------------------------------------------------

  function handlePrepTimeChange(val: string) {
    if (!hydrated) return
    setPrepTime(val)
    save({ restaurant: { ...buildOrderingPatch(), takeaway_prep_time_minutes: parseInt(val, 10) } })
  }

  function handleMinOrderChange(val: string) {
    setMinOrderInput(val)
    if (!hydrated) return
    const parsed = parseFloat(val)
    if (isNaN(parsed) || parsed < 0 || parsed > 500) {
      setMinOrderError(t('minOrderError'))
      return
    }
    setMinOrderError(null)
    const cents = Math.round(parsed * 100)
    save({ restaurant: { ...buildOrderingPatch(), takeaway_min_order_cents: cents } })
  }

  function handleSlotIntervalChange(val: string) {
    if (!hydrated) return
    setSlotInterval(val)
    save({ restaurant: { ...buildOrderingPatch(), takeaway_slot_interval_minutes: parseInt(val, 10) } })
  }

  function handleAcceptingChange(val: boolean) {
    if (!hydrated) return
    setAcceptingOrders(val)
    save({ restaurant: { ...buildOrderingPatch(), takeaway_accepting_orders: val } })
  }

  function handleItemNotesChange(val: boolean) {
    if (!hydrated) return
    setItemNotesAllowed(val)
    save({ restaurant: { ...buildOrderingPatch(), takeaway_item_notes_allowed: val } })
  }

  function handleScheduledChange(val: boolean) {
    if (!hydrated) return
    setScheduledOrdersAllowed(val)
    save({ restaurant: { ...buildOrderingPatch(), takeaway_scheduled_orders_allowed: val } })
  }

  // ---- Continue handler ------------------------------------------------------

  async function handleContinue() {
    if (submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const currIdx = visibleStepIds.indexOf(7)
      const nextStepId =
        currIdx >= 0 && currIdx < visibleStepIds.length - 1
          ? visibleStepIds[currIdx + 1]!
          : 8
      await saveNow({
        restaurant: { ...buildOrderingPatch(), current_onboarding_step: nextStepId },
      })
      const nextPath = stepPath(nextStepId, locale)
      if (nextPath) router.push(nextPath)
    } catch {
      setSubmitError(t('saveFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  // ---- Options ---------------------------------------------------------------

  const prepTimeOptions = PREP_TIME_PRESETS.map((v) => ({
    value: v,
    label: t(`options.min${v}`),
  }))

  const slotIntervalOptions = SLOT_INTERVAL_PRESETS.map((v) => ({
    value: v,
    label: t(`options.min${v}`),
  }))

  const backHref = previousStepPath(7, visibleStepIds, locale) ?? stepPath(6, locale)

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
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* Prep time */}
        <SelectField
          label={t('prepTimeLabel')}
          hint={t('prepTimeHint')}
          value={prepTime}
          onChange={handlePrepTimeChange}
          options={prepTimeOptions}
        />

        {/* Min order */}
        <div>
          <label
            style={{
              display: 'block',
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.2em',
              textTransform: 'uppercase' as const,
              color: '#9c8b6a',
              marginBottom: '8px',
            }}
          >
            {t('minOrderLabel')}
          </label>
          <div style={{ position: 'relative' }}>
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: '50%',
                left: '18px',
                transform: 'translateY(-50%)',
                fontFamily: 'var(--font-jost), Jost, sans-serif',
                fontSize: '15px',
                fontWeight: 400,
                color: '#9c8b6a',
                pointerEvents: 'none',
                zIndex: 1,
              }}
            >
              €
            </span>
            <input
              type="number"
              min={0}
              max={500}
              step={0.5}
              inputMode="decimal"
              lang="nl-NL"
              value={minOrderInput}
              onFocus={() => setMinOrderFocused(true)}
              onBlur={() => setMinOrderFocused(false)}
              onChange={(e) => handleMinOrderChange(e.target.value)}
              style={{
                width: '100%',
                padding: '14px 18px 14px 38px',
                backgroundColor: minOrderError ? '#fef2f2' : '#f8f2e6',
                border: '1.5px solid',
                borderColor: minOrderError
                  ? '#ef4444'
                  : minOrderFocused
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
                  minOrderFocused && !minOrderError
                    ? '0 0 0 4px rgba(212,130,10,0.08)'
                    : 'none',
              }}
            />
          </div>
          <p
            style={{
              margin: '6px 2px 0',
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontSize: '13px',
              fontWeight: 400,
              color: minOrderError ? '#ef4444' : '#9c8b6a',
              lineHeight: 1.4,
            }}
          >
            {minOrderError ?? t('minOrderHint')}
          </p>
        </div>

        {/* Pickup slot interval */}
        <SelectField
          label={t('slotIntervalLabel')}
          hint={t('slotIntervalHint')}
          value={slotInterval}
          onChange={handleSlotIntervalChange}
          options={slotIntervalOptions}
        />

        {/* Accept online orders */}
        <ToggleField
          label={t('acceptingLabel')}
          description={t('acceptingDescription')}
          value={acceptingOrders}
          onChange={handleAcceptingChange}
        />

        {/* Allow item notes */}
        <ToggleField
          label={t('itemNotesLabel')}
          description={t('itemNotesDescription')}
          value={itemNotesAllowed}
          onChange={handleItemNotesChange}
        />

        {/* Scheduled orders */}
        <ToggleField
          label={t('scheduledLabel')}
          description={t('scheduledDescription')}
          value={scheduledOrdersAllowed}
          onChange={handleScheduledChange}
        />

      </div>
    </StepFrame>
  )
}
