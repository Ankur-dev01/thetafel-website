'use client'

import { useState, useEffect, useCallback } from 'react'
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

const LEAD_TIME_PRESETS = ['0', '30', '60', '120', '240', '1440']
const PARTY_SIZE_PRESETS = ['2', '4', '6', '8', '10', '12', '15', '20']
const WINDOW_PRESETS = ['7', '14', '30', '60', '90', '180', '365']
const MAX_GUESTS_PRESETS = ['10', '15', '20', '25', '30', '40', '50']

// ---- Helpers -----------------------------------------------------------------

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

// ---- Page --------------------------------------------------------------------

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

  // Field state
  const [leadTime, setLeadTime] = useState<string>('60')
  const [partySize, setPartySize] = useState<string>('8')
  const [windowDays, setWindowDays] = useState<string>('90')
  const [maxGuests, setMaxGuests] = useState<string>('none')
  const [customGuests, setCustomGuests] = useState<string>('')
  const [customGuestsError, setCustomGuestsError] = useState<string | null>(null)
  const [customGuestsFocused, setCustomGuestsFocused] = useState(false)
  const [waitlist, setWaitlist] = useState<boolean>(true)
  const [zonePref, setZonePref] = useState<boolean>(true)

  // Submit
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

        // Wizard meta
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

        // min_lead_time_minutes
        const lt = String(parseInteger(r.min_lead_time_minutes, 60))
        if (LEAD_TIME_PRESETS.includes(lt)) {
          setLeadTime(lt)
        } else {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(
              '[rules] Unrecognised min_lead_time_minutes:',
              r.min_lead_time_minutes,
              '— falling back to 60'
            )
          }
          setLeadTime('60')
        }

        // max_party_size
        const ps = parseNullableInt(r.max_party_size)
        if (ps === null) {
          setPartySize('none')
        } else if (PARTY_SIZE_PRESETS.includes(String(ps))) {
          setPartySize(String(ps))
        } else {
          setPartySize('8')
        }

        // booking_window_days
        const wd = String(parseInteger(r.booking_window_days, 90))
        if (WINDOW_PRESETS.includes(wd)) {
          setWindowDays(wd)
        } else {
          setWindowDays('90')
        }

        // max_guests_per_slot
        const mg = parseNullableInt(r.max_guests_per_slot)
        if (mg === null) {
          setMaxGuests('none')
          setCustomGuests('')
        } else if (MAX_GUESTS_PRESETS.includes(String(mg))) {
          setMaxGuests(String(mg))
          setCustomGuests('')
        } else if (mg >= 2) {
          setMaxGuests('custom')
          setCustomGuests(String(mg))
        } else {
          setMaxGuests('none')
          setCustomGuests('')
        }

        // waitlist_enabled
        setWaitlist(parseBool(r.waitlist_enabled, true))

        // guest_zone_choice_enabled
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

  // ---- Change handlers -------------------------------------------------------

  const handleLeadTimeChange = useCallback(
    (val: string) => {
      if (!hydrated) return
      setLeadTime(val)
      save({ restaurant: { min_lead_time_minutes: parseInt(val, 10) } })
    },
    [hydrated, save]
  )

  const handlePartySizeChange = useCallback(
    (val: string) => {
      if (!hydrated) return
      setPartySize(val)
      save({
        restaurant: {
          max_party_size: val === 'none' ? null : parseInt(val, 10),
        },
      })
    },
    [hydrated, save]
  )

  const handleWindowDaysChange = useCallback(
    (val: string) => {
      if (!hydrated) return
      setWindowDays(val)
      save({ restaurant: { booking_window_days: parseInt(val, 10) } })
    },
    [hydrated, save]
  )

  const handleMaxGuestsChange = useCallback(
    (val: string) => {
      if (!hydrated) return
      setMaxGuests(val)
      if (val !== 'custom') {
        setCustomGuests('')
        setCustomGuestsError(null)
        save({
          restaurant: {
            max_guests_per_slot: val === 'none' ? null : parseInt(val, 10),
          },
        })
      }
    },
    [hydrated, save]
  )

  const handleCustomGuestsChange = useCallback(
    (val: string, errorMsg: string) => {
      if (!hydrated) return
      setCustomGuests(val)
      const parsed = parseInt(val, 10)
      if (!Number.isInteger(parsed) || parsed < 2 || parsed > 500) {
        setCustomGuestsError(errorMsg)
      } else {
        setCustomGuestsError(null)
        save({ restaurant: { max_guests_per_slot: parsed } })
      }
    },
    [hydrated, save]
  )

  const handleWaitlistChange = useCallback(
    (val: boolean) => {
      if (!hydrated) return
      setWaitlist(val)
      save({ restaurant: { waitlist_enabled: val } })
    },
    [hydrated, save]
  )

  const handleZonePrefChange = useCallback(
    (val: boolean) => {
      if (!hydrated) return
      setZonePref(val)
      save({ restaurant: { guest_zone_choice_enabled: val } })
    },
    [hydrated, save]
  )

  // ---- canContinue -----------------------------------------------------------

  const parsedCustom = parseInt(customGuests, 10)
  const customGuestsValid =
    maxGuests !== 'custom' ||
    (Number.isInteger(parsedCustom) && parsedCustom >= 2 && parsedCustom <= 500)

  const canContinue =
    hydrated &&
    LEAD_TIME_PRESETS.includes(leadTime) &&
    (partySize === 'none' || PARTY_SIZE_PRESETS.includes(partySize)) &&
    WINDOW_PRESETS.includes(windowDays) &&
    (maxGuests === 'none' ||
      MAX_GUESTS_PRESETS.includes(maxGuests) ||
      (maxGuests === 'custom' && customGuestsValid)) &&
    !submitting

  // ---- Continue --------------------------------------------------------------

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
      const maxGuestsValue: number | null =
        maxGuests === 'none'
          ? null
          : maxGuests === 'custom'
            ? Number.isInteger(parseInt(customGuests, 10)) &&
              parseInt(customGuests, 10) >= 2
              ? parseInt(customGuests, 10)
              : null
            : parseInt(maxGuests, 10)
      await saveNow({
        restaurant: {
          min_lead_time_minutes: parseInt(leadTime, 10),
          max_party_size: partySize === 'none' ? null : parseInt(partySize, 10),
          booking_window_days: parseInt(windowDays, 10),
          max_guests_per_slot: maxGuestsValue,
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
    partySize,
    windowDays,
    maxGuests,
    customGuests,
    waitlist,
    zonePref,
  ])

  // ---- Options ---------------------------------------------------------------

  const leadTimeOptions = [
    { value: '0', label: t('leadTimeOff') },
    { value: '30', label: t('leadTime30') },
    { value: '60', label: t('leadTime60') },
    { value: '120', label: t('leadTime120') },
    { value: '240', label: t('leadTime240') },
    { value: '1440', label: t('leadTime1440') },
  ]

  const partySizeOptions = [
    { value: '2', label: '2' },
    { value: '4', label: '4' },
    { value: '6', label: '6' },
    { value: '8', label: '8' },
    { value: '10', label: '10' },
    { value: '12', label: '12' },
    { value: '15', label: '15' },
    { value: '20', label: '20' },
    { value: 'none', label: t('noLimit') },
  ]

  const windowOptions = [
    { value: '7', label: t('window7') },
    { value: '14', label: t('window14') },
    { value: '30', label: t('window30') },
    { value: '60', label: t('window60') },
    { value: '90', label: t('window90') },
    { value: '180', label: t('window180') },
    { value: '365', label: t('window365') },
  ]

  const maxGuestsOptions = [
    { value: 'none', label: t('noLimit') },
    { value: '10', label: '10' },
    { value: '15', label: '15' },
    { value: '20', label: '20' },
    { value: '25', label: '25' },
    { value: '30', label: '30' },
    { value: '40', label: '40' },
    { value: '50', label: '50' },
    { value: 'custom', label: t('custom') },
  ]

  const backHref =
    previousStepPath(4, visibleStepIds, locale) ?? stepPath(3, locale)

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
      canContinue={canContinue}
      continueLabel={t('continue')}
      onContinue={handleContinue}
      isSubmitting={submitting}
      error={submitError}
      savedIndicator={<SavedIndicator state={saveState} locale={locale} />}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Min lead time */}
        <SelectField
          label={t('leadTimeLabel')}
          hint={t('leadTimeHint')}
          value={leadTime}
          onChange={handleLeadTimeChange}
          options={leadTimeOptions}
        />

        {/* Max party size */}
        <SelectField
          label={t('partySizeLabel')}
          hint={t('partySizeHint')}
          value={partySize}
          onChange={handlePartySizeChange}
          options={partySizeOptions}
        />

        {/* Booking window */}
        <SelectField
          label={t('windowLabel')}
          hint={t('windowHint')}
          value={windowDays}
          onChange={handleWindowDaysChange}
          options={windowOptions}
        />

        {/* Max guests per slot + optional custom input */}
        <div>
          <SelectField
            label={t('maxGuestsLabel')}
            hint={t('maxGuestsHint')}
            value={maxGuests}
            onChange={handleMaxGuestsChange}
            options={maxGuestsOptions}
          />
          {maxGuests === 'custom' && (
            <div style={{ marginTop: '10px' }}>
              <input
                type="number"
                min={2}
                max={500}
                step={1}
                inputMode="numeric"
                lang="nl-NL"
                value={customGuests}
                placeholder={t('customGuestsPlaceholder')}
                onChange={(e) =>
                  handleCustomGuestsChange(
                    e.target.value,
                    t('customGuestsErrorRange')
                  )
                }
                onFocus={() => setCustomGuestsFocused(true)}
                onBlur={() => setCustomGuestsFocused(false)}
                style={{
                  width: '100%',
                  padding: '14px 18px',
                  backgroundColor: customGuestsError ? '#fef2f2' : '#f8f2e6',
                  border: '1.5px solid',
                  borderColor: customGuestsError
                    ? '#ef4444'
                    : customGuestsFocused
                      ? 'rgba(212,130,10,0.5)'
                      : 'transparent',
                  borderRadius: '12px',
                  fontFamily: 'var(--font-jost), Jost, sans-serif',
                  fontSize: '15px',
                  fontWeight: 400,
                  color: '#1e1508',
                  outline: 'none',
                  transition: 'all 0.2s',
                  boxSizing: 'border-box',
                  boxShadow:
                    customGuestsFocused && !customGuestsError
                      ? '0 0 0 4px rgba(212,130,10,0.08)'
                      : 'none',
                }}
              />
              {customGuestsError && (
                <p
                  style={{
                    margin: '6px 2px 0',
                    fontFamily: 'var(--font-jost), Jost, sans-serif',
                    fontSize: '13px',
                    fontWeight: 400,
                    color: '#ef4444',
                    lineHeight: 1.4,
                  }}
                >
                  {customGuestsError}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Waitlist */}
        <ToggleField
          label={t('waitlistLabel')}
          description={t('waitlistDescription')}
          value={waitlist}
          onChange={handleWaitlistChange}
        />

        {/* Guest zone preference */}
        <ToggleField
          label={t('zonePreferenceLabel')}
          description={t('zonePreferenceDescription')}
          value={zonePref}
          onChange={handleZonePrefChange}
        />
      </div>
    </StepFrame>
  )
}
