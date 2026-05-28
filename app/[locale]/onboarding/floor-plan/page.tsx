'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import StepFrame from '@/components/onboarding/shell/StepFrame'
import SavedIndicator from '@/components/onboarding/shell/SavedIndicator'
import SelectField from '@/components/onboarding/fields/SelectField'
import {
  getVisibleSteps,
  getTotalWizardSteps,
  getDisplayedStepNumber,
} from '@/lib/onboarding/steps'
import { stepPath, previousStepPath } from '@/lib/onboarding/routes'
import { useDraftSave } from '@/lib/onboarding/useDraftSave'

// ---- Types ------------------------------------------------------------------

type LocalZone = {
  id: string      // real DB UUID, or '' while a save is in flight
  name: string
  display_order: number
  color: string
  saving: boolean // true during the PATCH→GET cycle for a newly added zone
}

type LocalTable = {
  tempId: string  // client-side React key
  zone_id: string // always a real DB UUID (zone must be persisted before table)
  label: string
  seats: number
  is_bookable: boolean
  is_qr_enabled: boolean
}

// ---- Module-level constants and helpers ------------------------------------

const TABLE_SIZES = [2, 4, 6, 8, 10] as const
const OCCUPANCY_OPTIONS_MINS = [45, 60, 75, 90, 105, 120, 150] as const
const TURNOVER_OPTIONS_MINS = [0, 10, 15, 20, 30] as const
const DEFAULT_OCCUPANCY = 90
const DEFAULT_TURNOVER = 15
const DEFAULT_COLOR = '#d4820a'
const DEFAULT_ZONE_NL = 'Binnenzaal'
const PARTY_SIZES = ['2', '4', '6', '8', '10'] as const

function extractTableNumber(label: string): number {
  const m = /^T(\d+)$/.exec(label)
  return m ? parseInt(m[1]!, 10) : 0
}

// Returns the lowest positive integer N such that T{N} is not already in use,
// scanning all tables across all zones (labels are per-restaurant).
function nextFreeTableLabel(tables: LocalTable[]): string {
  const used = new Set(
    tables.map((t) => extractTableNumber(t.label)).filter((n) => n > 0)
  )
  let n = 1
  while (used.has(n)) n++
  return `T${n}`
}

function buildPartyMap(
  durations: Record<string, string>
): Record<string, number> {
  const result: Record<string, number> = {}
  for (const [size, val] of Object.entries(durations)) {
    const n = parseInt(val, 10)
    if (!isNaN(n) && n > 0) result[size] = n
  }
  return result
}

type ServerZone = {
  id: string
  name: string
  display_order: number
  color: string
  deleted_at: string | null
}
type ServerTable = {
  id: string
  zone_id: string
  label: string
  seats: number
  is_bookable: boolean
  is_qr_enabled: boolean
  deleted_at: string | null
}
type DraftResponse = {
  restaurant: Record<string, unknown>
  zones: ServerZone[]
  tables: ServerTable[]
}

async function fetchDraft(): Promise<DraftResponse> {
  const res = await fetch('/api/v1/restaurants/draft', {
    method: 'GET',
    cache: 'no-store',
  })
  if (!res.ok) throw new Error('GET failed')
  return res.json() as Promise<DraftResponse>
}

// Sends a zones-only PATCH then re-fetches the full draft (needed to get
// server-generated zone UUIDs). The two-step round-trip is intentional:
// PATCH returns only the refreshed restaurant row, not zones.
async function patchZonesAndRefresh(
  zones: Array<{ name: string; display_order: number; color: string }>
): Promise<DraftResponse> {
  const patchRes = await fetch('/api/v1/restaurants/draft', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ zones }),
    cache: 'no-store',
  })
  if (!patchRes.ok) throw new Error('Zones PATCH failed')
  return fetchDraft()
}

// ---- Page component --------------------------------------------------------

export default function FloorPlanPage() {
  const t = useTranslations('onboarding.floorPlan')
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
  const [currentDisplayNum, setCurrentDisplayNum] = useState(2)

  // Core state
  const [zones, setZones] = useState<LocalZone[]>([])
  const [tables, setTables] = useState<LocalTable[]>([])
  const [selectedSize, setSelectedSize] = useState<(typeof TABLE_SIZES)[number]>(2)

  // Zone creation UI
  const [isAddingZone, setIsAddingZone] = useState(false)
  const [newZoneName, setNewZoneName] = useState('')
  const [zonePersisting, setZonePersisting] = useState(false)
  const [zoneError, setZoneError] = useState<string | null>(null)

  // Occupancy / turnover
  const [occupancyMinutes, setOccupancyMinutes] = useState(DEFAULT_OCCUPANCY)
  const [occupancyMode, setOccupancyMode] = useState<'fixed' | 'per_party'>('fixed')
  const [partyDurations, setPartyDurations] = useState<Record<string, string>>({})
  const [turnoverMinutes, setTurnoverMinutes] = useState(DEFAULT_TURNOVER)

  // Continue
  const [isContinuing, setIsContinuing] = useState(false)

  // ---- Hydration -----------------------------------------------------------

  useEffect(() => {
    let cancelled = false

    async function hydrate() {
      try {
        let data = await fetchDraft()

        if (cancelled) return

        const r = data.restaurant ?? {}

        // Compute step position for progress bar
        try {
          const visibleSteps = getVisibleSteps(
            r as Parameters<typeof getVisibleSteps>[0]
          )
          setTotalSteps(getTotalWizardSteps(visibleSteps))
          setVisibleStepIds(visibleSteps.map((s) => s.id))
          setCurrentDisplayNum(getDisplayedStepNumber(2, visibleSteps) ?? 2)
        } catch {
          // Leave defaults
        }

        // Occupancy / turnover
        const byParty = r.occupancy_duration_by_party as
          | Record<string, number>
          | null
          | undefined
        if (byParty && Object.keys(byParty).length > 0) {
          setOccupancyMode('per_party')
          setPartyDurations(
            Object.fromEntries(
              Object.entries(byParty).map(([k, v]) => [k, String(v)])
            )
          )
        }
        if (typeof r.occupancy_duration_minutes === 'number') {
          setOccupancyMinutes(r.occupancy_duration_minutes)
        }
        if (typeof r.turnover_buffer_minutes === 'number') {
          setTurnoverMinutes(r.turnover_buffer_minutes)
        }

        // Parse zones
        let loadedZones: LocalZone[] = (data.zones ?? [])
          .filter((z) => !z.deleted_at)
          .sort((a, b) => a.display_order - b.display_order)
          .map((z) => ({
            id: z.id,
            name: z.name,
            display_order: z.display_order,
            color: z.color,
            saving: false,
          }))

        // Parse tables
        const loadedTables: LocalTable[] = (data.tables ?? [])
          .filter((t) => !t.deleted_at)
          .map((t) => ({
            tempId: t.id,
            zone_id: t.zone_id,
            label: t.label,
            seats: t.seats,
            is_bookable: t.is_bookable,
            is_qr_enabled: t.is_qr_enabled,
          }))

        // Auto-create the default zone on first visit (no zones yet)
        if (loadedZones.length === 0) {
          try {
            const refreshed = await patchZonesAndRefresh([
              { name: DEFAULT_ZONE_NL, display_order: 0, color: DEFAULT_COLOR },
            ])
            loadedZones = refreshed.zones
              .filter((z) => !z.deleted_at)
              .map((z) => ({
                id: z.id,
                name: z.name,
                display_order: z.display_order,
                color: z.color,
                saving: false,
              }))
          } catch {
            // Not fatal — owner can add a zone manually
          }
        }

        if (!cancelled) {
          setZones(loadedZones)
          setTables(loadedTables)
          setHydrating(false)
        }
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

  // ---- Zone actions --------------------------------------------------------

  const handleAddZoneConfirm = useCallback(async () => {
    const name = newZoneName.trim()
    if (!name) {
      setZoneError(t('errors.zoneNameRequired'))
      return
    }
    if (zones.some((z) => z.name.toLowerCase() === name.toLowerCase())) {
      setZoneError(t('errors.zoneNameDuplicate'))
      return
    }

    setZoneError(null)
    setIsAddingZone(false)
    setNewZoneName('')

    // Show the zone immediately with a "saving" marker so the UI
    // feels snappy. The marker disables "Add table" until the zone
    // has a real DB UUID (i.e. the PATCH→GET round-trip completes).
    const tempZone: LocalZone = {
      id: '',
      name,
      display_order: zones.length,
      color: DEFAULT_COLOR,
      saving: true,
    }
    const optimisticZones = [...zones, tempZone]
    setZones(optimisticZones)
    setZonePersisting(true)

    try {
      const refreshed = await patchZonesAndRefresh(
        optimisticZones.map((z, i) => ({
          name: z.name,
          display_order: i,
          color: z.color,
        }))
      )
      const serverZones = refreshed.zones.filter((z) => !z.deleted_at)

      setZones((prev) =>
        prev.map((z) => {
          if (z.id !== '') return { ...z, saving: false }
          const server = serverZones.find((sz) => sz.name === z.name)
          return server
            ? {
                id: server.id,
                name: server.name,
                display_order: server.display_order,
                color: server.color,
                saving: false,
              }
            : z // shouldn't happen
        })
      )
    } catch {
      setZones((prev) => prev.filter((z) => z.id !== ''))
      setZoneError(t('errors.zoneSaveFailed'))
    } finally {
      setZonePersisting(false)
    }
  }, [zones, newZoneName, t])

  const handleRemoveZone = useCallback(
    async (zoneId: string) => {
      const nextZones = zones.filter((z) => z.id !== zoneId)
      const nextTables = tables.filter((t) => t.zone_id !== zoneId)
      setZones(nextZones)
      setTables(nextTables)

      try {
        await saveNow({
          zones: nextZones.map((z, i) => ({
            name: z.name,
            display_order: i,
            color: z.color,
          })),
          tables: nextTables.map((t) => ({
            zone_id: t.zone_id,
            label: t.label,
            seats: t.seats,
            is_bookable: t.is_bookable,
            is_qr_enabled: t.is_qr_enabled,
          })),
        })
      } catch {
        // Error surfaced via saveState
      }
    },
    [zones, tables, saveNow]
  )

  // ---- Table actions -------------------------------------------------------

  const handleAddTable = useCallback(
    (zoneId: string) => {
      const label = nextFreeTableLabel(tables)
      const newTable: LocalTable = {
        tempId: `${label}-${Date.now()}`,
        zone_id: zoneId,
        label,
        seats: selectedSize,
        is_bookable: true,
        is_qr_enabled: true,
      }
      const nextTables = [...tables, newTable]
      setTables(nextTables)

      save({
        tables: nextTables.map((t) => ({
          zone_id: t.zone_id,
          label: t.label,
          seats: t.seats,
          is_bookable: t.is_bookable,
          is_qr_enabled: t.is_qr_enabled,
        })),
      })
    },
    [tables, selectedSize, save]
  )

  const handleRemoveTable = useCallback(
    (label: string) => {
      const nextTables = tables.filter((t) => t.label !== label)
      setTables(nextTables)

      save({
        tables: nextTables.map((t) => ({
          zone_id: t.zone_id,
          label: t.label,
          seats: t.seats,
          is_bookable: t.is_bookable,
          is_qr_enabled: t.is_qr_enabled,
        })),
      })
    },
    [tables, save]
  )

  // ---- Occupancy / turnover actions ----------------------------------------

  const handleOccupancyChange = useCallback(
    (val: string) => {
      if (val === 'per_party') {
        setOccupancyMode('per_party')
        const parsed = buildPartyMap(partyDurations)
        save({ restaurant: { occupancy_duration_by_party: parsed } })
      } else {
        const minutes = parseInt(val, 10)
        setOccupancyMinutes(minutes)
        setOccupancyMode('fixed')
        // Send empty record to clear any stored per-party data so that
        // reloads don't re-enter per-party mode.
        save({
          restaurant: {
            occupancy_duration_minutes: minutes,
            occupancy_duration_by_party: {},
          },
        })
      }
    },
    [partyDurations, save]
  )

  const handlePartyDurationChange = useCallback(
    (size: string, val: string) => {
      const next = { ...partyDurations, [size]: val }
      setPartyDurations(next)
      const parsed = buildPartyMap(next)
      if (Object.keys(parsed).length > 0) {
        save({ restaurant: { occupancy_duration_by_party: parsed } })
      }
    },
    [partyDurations, save]
  )

  const handleTurnoverChange = useCallback(
    (val: string) => {
      const minutes = parseInt(val, 10)
      setTurnoverMinutes(minutes)
      save({ restaurant: { turnover_buffer_minutes: minutes } })
    },
    [save]
  )

  // ---- Continue handler ----------------------------------------------------

  const handleContinue = useCallback(async () => {
    if (isContinuing) return
    setIsContinuing(true)
    try {
      const currIdx = visibleStepIds.indexOf(2)
      const nextStepId =
        currIdx >= 0 && currIdx < visibleStepIds.length - 1
          ? visibleStepIds[currIdx + 1]!
          : 3
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

  const totalTables = tables.length
  const totalSeats = tables.reduce((sum, t) => sum + t.seats, 0)
  const totalZones = zones.length
  const maxPerShift = totalSeats

  const canContinue =
    totalZones >= 1 &&
    totalTables >= 1 &&
    !isContinuing &&
    !zonePersisting

  const backHref =
    previousStepPath(2, visibleStepIds, locale) ?? stepPath(1, locale)

  const occupancySelectValue =
    occupancyMode === 'per_party' ? 'per_party' : String(occupancyMinutes)

  const occupancyOptions = [
    ...OCCUPANCY_OPTIONS_MINS.map((m) => ({
      value: String(m),
      label: `${m} ${t('minutesSuffix')}`,
    })),
    { value: 'per_party', label: t('occupancyPerParty') },
  ]

  const turnoverOptions = TURNOVER_OPTIONS_MINS.map((m) => ({
    value: String(m),
    label: `${m} ${t('minutesSuffix')}`,
  }))

  // ---- Shared inline styles ------------------------------------------------

  const sectionLabelStyle: React.CSSProperties = {
    display: 'block',
    fontFamily: 'var(--font-jost), sans-serif',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    color: 'var(--stone)',
    marginBottom: '10px',
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
          maxWidth: '840px',
          margin: '0 auto',
          width: '100%',
        }}
      >
        {/* Summary tiles */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
          }}
        >
          <SummaryTile label={t('tiles.tables')} value={totalTables} />
          <SummaryTile label={t('tiles.seats')} value={totalSeats} />
          <SummaryTile label={t('tiles.zones')} value={totalZones} />
          <SummaryTile label={t('tiles.maxPerShift')} value={maxPerShift} />
        </div>

        {/* Table-size selector */}
        <div>
          <div style={sectionLabelStyle}>{t('sizeSelector')}</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {TABLE_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => setSelectedSize(size)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '999px',
                  border: '1.5px solid',
                  borderColor:
                    selectedSize === size
                      ? 'var(--amber)'
                      : 'rgba(156,139,106,0.3)',
                  backgroundColor:
                    selectedSize === size
                      ? 'rgba(212,130,10,0.12)'
                      : 'transparent',
                  color:
                    selectedSize === size ? 'var(--amber)' : 'var(--earth)',
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontSize: '14px',
                  fontWeight: selectedSize === size ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {size}p
              </button>
            ))}
          </div>
        </div>

        {/* Zones area */}
        <div>
          {/* Zones header row */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
            }}
          >
            <div style={sectionLabelStyle}>Zones</div>
            {!isAddingZone && (
              <button
                type="button"
                onClick={() => {
                  setIsAddingZone(true)
                  setNewZoneName('')
                  setZoneError(null)
                }}
                disabled={zonePersisting}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px 0',
                  cursor: zonePersisting ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: zonePersisting ? 'var(--stone)' : 'var(--amber)',
                  opacity: zonePersisting ? 0.5 : 1,
                }}
              >
                {t('addZone')}
              </button>
            )}
          </div>

          {/* New zone inline input */}
          {isAddingZone && (
            <div
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                marginBottom: '16px',
                flexWrap: 'wrap',
              }}
            >
              <input
                type="text"
                autoFocus
                value={newZoneName}
                onChange={(e) => {
                  setNewZoneName(e.target.value)
                  setZoneError(null)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    void handleAddZoneConfirm()
                  }
                  if (e.key === 'Escape') {
                    setIsAddingZone(false)
                    setNewZoneName('')
                    setZoneError(null)
                  }
                }}
                placeholder={t('zoneNamePlaceholder')}
                maxLength={100}
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: `1.5px solid ${zoneError ? '#ef4444' : 'rgba(212,130,10,0.4)'}`,
                  backgroundColor: 'var(--warm)',
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontSize: '14px',
                  color: 'var(--earth)',
                  outline: 'none',
                  width: '200px',
                  boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => void handleAddZoneConfirm()}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: 'var(--amber)',
                  color: '#fff',
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {t('confirmZone')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingZone(false)
                  setNewZoneName('')
                  setZoneError(null)
                }}
                style={{
                  padding: '10px 16px',
                  borderRadius: '10px',
                  border: '1px solid rgba(156,139,106,0.3)',
                  backgroundColor: 'transparent',
                  color: 'var(--stone)',
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                {t('cancelZone')}
              </button>
            </div>
          )}

          {zoneError && (
            <div
              style={{
                marginBottom: '12px',
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '13px',
                color: '#dc2626',
              }}
            >
              {zoneError}
            </div>
          )}

          {/* Zone cards — auto-fit columns stack to single column on narrow viewports */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
              gap: '16px',
              alignItems: 'start',
            }}
          >
            {zones.map((zone) => (
              <ZoneCard
                key={zone.id || zone.name}
                zone={zone}
                zoneTables={tables.filter((tbl) => tbl.zone_id === zone.id)}
                isLast={zones.length <= 1}
                canAddTable={!zone.saving && zone.id !== ''}
                onAddTable={() => handleAddTable(zone.id)}
                onRemoveTable={handleRemoveTable}
                onRemoveZone={() => void handleRemoveZone(zone.id)}
                addTableLabel={t('addTable')}
                removeZoneLabel={t('removeZone')}
                removeTableLabel={t('removeTable')}
              />
            ))}
          </div>
        </div>

        {/* Occupancy duration dropdown */}
        <SelectField
          label={t('occupancyLabel')}
          value={occupancySelectValue}
          onChange={handleOccupancyChange}
          options={occupancyOptions}
        />

        {/* Per-party size grid */}
        {occupancyMode === 'per_party' && (
          <div style={{ paddingLeft: '2px' }}>
            <div style={{ ...sectionLabelStyle, marginBottom: '12px' }}>
              {t('partyGridLabel')}
            </div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                gap: '12px',
              }}
            >
              {PARTY_SIZES.map((size) => (
                <div key={size}>
                  <div
                    style={{
                      fontFamily: 'var(--font-jost), sans-serif',
                      fontSize: '11px',
                      color: 'var(--stone)',
                      marginBottom: '6px',
                    }}
                  >
                    {size} {t('partySize')}
                  </div>
                  <input
                    type="number"
                    min="15"
                    max="600"
                    value={partyDurations[size] ?? ''}
                    onChange={(e) =>
                      handlePartyDurationChange(size, e.target.value)
                    }
                    placeholder="—"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      border: '1.5px solid rgba(156,139,106,0.3)',
                      backgroundColor: 'var(--warm)',
                      fontFamily: 'var(--font-jost), sans-serif',
                      fontSize: '14px',
                      color: 'var(--earth)',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Turnover buffer dropdown */}
        <SelectField
          label={t('turnoverLabel')}
          value={String(turnoverMinutes)}
          onChange={handleTurnoverChange}
          options={turnoverOptions}
        />
      </div>
    </StepFrame>
  )
}

// ---- SummaryTile sub-component ---------------------------------------------

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        backgroundColor: 'var(--warm)',
        borderRadius: '12px',
        padding: '16px 12px',
        border: '1px solid rgba(156,139,106,0.15)',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontSize: '26px',
          fontWeight: 700,
          color: 'var(--earth)',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontSize: '10px',
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--stone)',
          marginTop: '6px',
        }}
      >
        {label}
      </div>
    </div>
  )
}

// ---- ZoneCard sub-component ------------------------------------------------

type ZoneCardProps = {
  zone: LocalZone
  zoneTables: LocalTable[]
  isLast: boolean
  canAddTable: boolean
  onAddTable: () => void
  onRemoveTable: (label: string) => void
  onRemoveZone: () => void
  addTableLabel: string
  removeZoneLabel: string
  removeTableLabel: string
}

function ZoneCard({
  zone,
  zoneTables,
  isLast,
  canAddTable,
  onAddTable,
  onRemoveTable,
  onRemoveZone,
  addTableLabel,
  removeZoneLabel,
  removeTableLabel,
}: ZoneCardProps) {
  return (
    <div
      style={{
        backgroundColor: 'var(--warm)',
        borderRadius: '14px',
        border: '1px solid rgba(156,139,106,0.2)',
        overflow: 'hidden',
      }}
    >
      {/* Zone header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          backgroundColor: 'rgba(212,130,10,0.07)',
          borderBottom: '1px solid rgba(156,139,106,0.12)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--earth)',
            }}
          >
            {zone.name}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: '12px',
              color: 'var(--stone)',
            }}
          >
            ({zoneTables.length})
          </span>
          {zone.saving && (
            <span
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '12px',
                color: 'var(--stone)',
              }}
            >
              …
            </span>
          )}
        </div>

        {/* Remove zone — hidden for the last zone and while saving */}
        {!isLast && !zone.saving && (
          <button
            type="button"
            onClick={onRemoveZone}
            aria-label={removeZoneLabel}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
              color: 'var(--stone)',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '6px',
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Tables list */}
      <div style={{ padding: zoneTables.length > 0 ? '4px 0' : '0' }}>
        {zoneTables.map((tbl) => (
          <div
            key={tbl.tempId}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '9px 16px',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '14px',
                fontWeight: 500,
                color: 'var(--earth)',
              }}
            >
              {tbl.label}
            </span>
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '12px' }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontSize: '13px',
                  color: 'var(--stone)',
                }}
              >
                {tbl.seats}p
              </span>
              <button
                type="button"
                onClick={() => onRemoveTable(tbl.label)}
                aria-label={`${removeTableLabel} ${tbl.label}`}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '2px',
                  cursor: 'pointer',
                  color: 'var(--stone)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add table — only available once zone has a real DB UUID */}
      {canAddTable && (
        <div
          style={{
            borderTop: zoneTables.length > 0 ? '1px solid rgba(156,139,106,0.1)' : 'none',
          }}
        >
          <button
            type="button"
            onClick={onAddTable}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '11px 16px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: '13px',
              fontWeight: 500,
              color: 'var(--amber)',
            }}
          >
            {addTableLabel}
          </button>
        </div>
      )}
    </div>
  )
}
