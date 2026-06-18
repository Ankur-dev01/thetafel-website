'use client'

import { useState, useEffect, useCallback } from 'react'
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

type LocalZone = {
  id: string
  name: string
  display_order: number
  color: string
  saving: boolean
}

type LocalTable = {
  tempId: string
  zone_id: string
  label: string
  seats: number
  is_bookable: boolean
  is_qr_enabled: boolean
}

// ---- Constants & helpers ----------------------------------------------------

const TABLE_SIZES = [2, 4, 6, 8, 10] as const
const OCCUPANCY_OPTIONS_MINS = [45, 60, 75, 90, 105, 120, 150] as const
const TURNOVER_OPTIONS_MINS = [0, 10, 15, 20, 30] as const
const DEFAULT_OCCUPANCY = 90
const DEFAULT_TURNOVER = 15
const DEFAULT_COLOR = '#d4820a'
const PARTY_SIZES = ['2', '4', '6', '8', '10'] as const

function numericLabelSort<T extends { label: string }>(a: T, b: T): number {
  const an = parseInt(a.label.replace(/\D/g, ''), 10) || 0
  const bn = parseInt(b.label.replace(/\D/g, ''), 10) || 0
  return an !== bn ? an - bn : a.label.localeCompare(b.label)
}

function extractTableNumber(label: string): number {
  const m = /^T(\d+)$/.exec(label)
  return m ? parseInt(m[1]!, 10) : 0
}

function nextFreeTableLabel(tables: LocalTable[]): string {
  const used = new Set(
    tables.map((t) => extractTableNumber(t.label)).filter((n) => n > 0)
  )
  let n = 1
  while (used.has(n)) n++
  return `T${n}`
}

function buildPartyMap(durations: Record<string, string>): Record<string, number> {
  const result: Record<string, number> = {}
  for (const [size, val] of Object.entries(durations)) {
    const n = parseInt(val, 10)
    if (!isNaN(n) && n > 0) result[size] = n
  }
  return result
}

function capacityColor(seats: number): { bg: string; color: string } {
  if (seats <= 2) return { bg: '#a13434', color: '#fffefb' }
  if (seats <= 4) return { bg: '#d4820a', color: '#1e1508' }
  if (seats <= 6) return { bg: '#5d8a3a', color: '#fffefb' }
  if (seats <= 8) return { bg: '#8a5208', color: '#fffefb' }
  return { bg: '#1e1508', color: '#d4820a' }
}

type ServerZone = {
  id: string; name: string; display_order: number; color: string; deleted_at: string | null
}
type ServerTable = {
  id: string; zone_id: string; label: string; seats: number;
  is_bookable: boolean; is_qr_enabled: boolean; deleted_at: string | null
}
type DraftResponse = {
  restaurant: Record<string, unknown>
  zones: ServerZone[]
  tables: ServerTable[]
}

async function fetchDraft(): Promise<DraftResponse> {
  const res = await fetch('/api/v1/restaurants/draft', { method: 'GET', cache: 'no-store' })
  if (!res.ok) throw new Error('GET failed')
  return res.json() as Promise<DraftResponse>
}

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

// ---- Sub-components ---------------------------------------------------------

function StatCard({
  value, label, tileBg, tileColor, icon,
}: {
  value: number
  label: string
  tileBg: string
  tileColor: string
  icon: React.ReactNode
}) {
  return (
    <div style={{
      backgroundColor: 'var(--cream-card)',
      border: '1px solid #ebe2cf',
      borderRadius: '18px',
      padding: '22px 22px 18px',
      position: 'relative',
      boxShadow: '0 1px 2px rgba(40, 30, 10, 0.04)',
    }}>
      {/* Icon tile */}
      <div style={{
        position: 'absolute',
        top: 18, right: 18,
        width: 30, height: 30,
        borderRadius: 9,
        backgroundColor: tileBg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: tileColor,
      }}>
        {icon}
      </div>
      {/* Number */}
      <div style={{
        fontFamily: 'var(--font-raleway), Raleway, sans-serif',
        fontWeight: 900,
        fontSize: '40px',
        lineHeight: 1,
        color: tileColor,
      }}>
        {value}
      </div>
      {/* Label */}
      <div style={{
        fontFamily: 'var(--font-jost), Jost, sans-serif',
        fontWeight: 700,
        fontSize: '11px',
        letterSpacing: '0.13em',
        textTransform: 'uppercase',
        color: '#9a8e7b',
        marginTop: '10px',
      }}>
        {label}
      </div>
    </div>
  )
}

function TableTile({
  table, onRemove, removeLabel,
}: {
  table: LocalTable
  onRemove: () => void
  removeLabel: string
}) {
  const [hovered, setHovered] = useState(false)
  const { bg, color } = capacityColor(table.seats)
  const seats = Math.min(table.seats, 12)

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        width: 140,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        padding: '14px 6px 8px',
        transition: 'transform 150ms ease',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
      }}
    >
      {/* X button */}
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        style={{
          position: 'absolute',
          top: 0,
          right: 14,
          width: 24,
          height: 24,
          borderRadius: '9999px',
          border: 'none',
          backgroundColor: '#fffefb',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: hovered ? 1 : 0.45,
          transition: 'opacity 150ms ease',
          padding: 0,
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--stone-dim)" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>

      {/* Floor footprint */}
      <div style={{ position: 'relative', width: 120, height: 120 }}>
        {/* Seats */}
        {Array.from({ length: seats }, (_, i) => {
          const angle = (360 / seats) * i
          return (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: 18,
                height: 13,
                borderRadius: 5,
                backgroundColor: '#c0ae8e',
                boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
                transform: `translate(-50%, -50%) rotate(${angle}deg) translateY(-46px)`,
              }}
            />
          )
        })}

        {/* Center square */}
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 58,
          height: 58,
          borderRadius: 16,
          backgroundColor: bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 10px rgba(40, 30, 10, 0.18)',
        }}>
          <span style={{
            fontFamily: 'var(--font-raleway), Raleway, sans-serif',
            fontWeight: 900,
            fontSize: '22px',
            color,
          }}>
            {table.seats}
          </span>
        </div>
      </div>

      {/* Label */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
        <span style={{
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontWeight: 700,
          fontSize: '15px',
          color: 'var(--earth)',
        }}>
          {table.label}
        </span>
        <span style={{
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontWeight: 500,
          fontSize: '13px',
          color: '#9a8e7b',
        }}>
          {table.seats}p
        </span>
      </div>
    </div>
  )
}

function AddTableButton({ onClick, label }: { onClick: () => void; label: string }) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        width: 140,
        minHeight: 152,
        border: `2px dashed ${hovered ? 'var(--amber)' : 'var(--cream-border)'}`,
        borderRadius: 14,
        backgroundColor: hovered ? 'var(--amber-bg)' : 'transparent',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        color: '#b0894a',
        transition: 'all 150ms ease',
        padding: 0,
      }}
    >
      <div style={{
        width: 38,
        height: 38,
        borderRadius: '9999px',
        backgroundColor: 'var(--amber-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--amber-deep)" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      </div>
      <span style={{
        fontFamily: 'var(--font-jost), Jost, sans-serif',
        fontWeight: 700,
        fontSize: '14px',
      }}>
        {label}
      </span>
    </button>
  )
}

type ZoneCardV2Props = {
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

function ZoneCardV2({
  zone, zoneTables, isLast, canAddTable, onAddTable,
  onRemoveTable, onRemoveZone, addTableLabel, removeZoneLabel, removeTableLabel,
}: ZoneCardV2Props) {
  return (
    <div style={{
      backgroundColor: 'var(--cream-card)',
      border: '1px solid #ebe2cf',
      borderRadius: '20px',
      overflow: 'hidden',
      marginBottom: '36px',
      boxShadow: '0 2px 6px rgba(40, 30, 10, 0.05)',
    }}>
      {/* Zone header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '18px 26px',
        backgroundColor: 'var(--cream-hover)',
        borderBottom: '1px solid var(--cream-border)',
      }}>
        {/* Color dot */}
        <span style={{
          width: 10,
          height: 10,
          borderRadius: 3,
          backgroundColor: zone.color || 'var(--amber)',
          flexShrink: 0,
          display: 'inline-block',
        }} />

        {/* Zone name */}
        <span style={{
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontWeight: 700,
          fontSize: '17px',
          color: 'var(--earth)',
          flex: 1,
        }}>
          {zone.name}
          {zone.saving && (
            <span style={{ color: 'var(--stone)', fontWeight: 400, marginLeft: 6, fontSize: '13px' }}>…</span>
          )}
        </span>

        {/* Table count */}
        <span style={{
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontWeight: 500,
          fontSize: '15px',
          color: '#9a8e7b',
        }}>
          ({zoneTables.length})
        </span>

        {/* Remove zone button */}
        {!isLast && !zone.saving && (
          <button
            type="button"
            onClick={onRemoveZone}
            aria-label={removeZoneLabel}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 6px',
              cursor: 'pointer',
              color: 'var(--stone)',
              display: 'flex',
              alignItems: 'center',
              borderRadius: 6,
              marginLeft: 4,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Floor visualization */}
      <div style={{
        padding: '30px 26px',
        backgroundColor: '#f6efe1',
        backgroundImage: [
          'repeating-linear-gradient(90deg, rgba(30, 21, 8, 0.05) 0 1px, transparent 1px 30px)',
          'repeating-linear-gradient(0deg, rgba(30, 21, 8, 0.04) 0 1px, transparent 1px 30px)',
        ].join(', '),
        display: 'flex',
        flexWrap: 'wrap',
        gap: '18px',
        minHeight: 80,
      }}>
        {zoneTables.map((tbl) => (
          <TableTile
            key={tbl.tempId}
            table={tbl}
            onRemove={() => onRemoveTable(tbl.label)}
            removeLabel={`${removeTableLabel} ${tbl.label}`}
          />
        ))}
        {canAddTable && (
          <AddTableButton onClick={onAddTable} label={addTableLabel} />
        )}
      </div>
    </div>
  )
}

function StyledSelect({
  label, value, onChange, options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  const [focused, setFocused] = useState(false)

  return (
    <div>
      <div style={{
        fontFamily: 'var(--font-jost), Jost, sans-serif',
        fontWeight: 700,
        fontSize: '12px',
        letterSpacing: '0.13em',
        textTransform: 'uppercase',
        color: '#9a8259',
        marginBottom: '10px',
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
            padding: '17px 44px 17px 18px',
            backgroundColor: 'var(--cream-card)',
            border: `1.5px solid ${focused ? 'rgba(212, 130, 10, 0.5)' : 'var(--cream-border)'}`,
            borderRadius: '14px',
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontSize: '15px',
            fontWeight: 400,
            color: 'var(--earth)',
            outline: 'none',
            boxShadow: focused ? '0 0 0 4px rgba(212, 130, 10, 0.08)' : 'none',
            appearance: 'none',
            WebkitAppearance: 'none',
            cursor: 'pointer',
            boxSizing: 'border-box',
            transition: 'border-color 200ms ease, box-shadow 200ms ease',
          } as React.CSSProperties}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="var(--stone)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '50%', right: '18px',
            transform: 'translateY(-50%)',
            pointerEvents: 'none',
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>
    </div>
  )
}

// ---- Page -------------------------------------------------------------------

export default function FloorPlanPage() {
  const t = useTranslations('onboarding.floorPlan')
  const params = useParams()
  const locale: 'nl' | 'en' = (params?.locale as string) === 'en' ? 'en' : 'nl'
  const router = useRouter()
  const pathname = usePathname()
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
  const [selectedSize, setSelectedSize] = useState<(typeof TABLE_SIZES)[number]>(4)

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

  // ---- Hydration -------------------------------------------------------------

  useEffect(() => {
    let cancelled = false

    async function hydrate() {
      try {
        const data = await fetchDraft()
        if (cancelled) return

        const r = data.restaurant ?? {}

        try {
          const visibleSteps = getVisibleSteps(r as Parameters<typeof getVisibleSteps>[0])
          setTotalSteps(getTotalWizardSteps(visibleSteps))
          setVisibleStepIds(visibleSteps.map((s) => s.id))
          setCurrentDisplayNum(getDisplayedStepNumber(2, visibleSteps) ?? 2)
        } catch {
          // leave defaults
        }

        const byParty = r.occupancy_duration_by_party as Record<string, number> | null | undefined
        if (byParty && Object.keys(byParty).length > 0) {
          setOccupancyMode('per_party')
          setPartyDurations(
            Object.fromEntries(Object.entries(byParty).map(([k, v]) => [k, String(v)]))
          )
        }
        if (typeof r.occupancy_duration_minutes === 'number') {
          setOccupancyMinutes(r.occupancy_duration_minutes)
        }
        if (typeof r.turnover_buffer_minutes === 'number') {
          setTurnoverMinutes(r.turnover_buffer_minutes)
        }

        let loadedZones: LocalZone[] = (data.zones ?? [])
          .filter((z) => !z.deleted_at)
          .sort((a, b) => a.display_order - b.display_order)
          .map((z) => ({ id: z.id, name: z.name, display_order: z.display_order, color: z.color, saving: false }))

        const loadedTables: LocalTable[] = (data.tables ?? [])
          .filter((t) => !t.deleted_at)
          .map((t) => ({
            tempId: t.id, zone_id: t.zone_id, label: t.label, seats: t.seats,
            is_bookable: t.is_bookable, is_qr_enabled: t.is_qr_enabled,
          }))
          .sort(numericLabelSort)

        const defaultZoneName = locale === 'en' ? 'Main hall' : 'Binnenzaal'

        if (loadedZones.length === 0) {
          try {
            const refreshed = await patchZonesAndRefresh([
              { name: defaultZoneName, display_order: 0, color: DEFAULT_COLOR },
            ])
            loadedZones = refreshed.zones.filter((z) => !z.deleted_at).map((z) => ({
              id: z.id, name: z.name, display_order: z.display_order, color: z.color, saving: false,
            }))
          } catch {
            // not fatal
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
    return () => { cancelled = true }
  }, [t, pathname])

  // ---- Zone actions ----------------------------------------------------------

  const handleAddZoneConfirm = useCallback(async () => {
    const name = newZoneName.trim()
    if (!name) { setZoneError(t('errors.zoneNameRequired')); return }
    if (zones.some((z) => z.name.toLowerCase() === name.toLowerCase())) {
      setZoneError(t('errors.zoneNameDuplicate')); return
    }
    setZoneError(null)
    setIsAddingZone(false)
    setNewZoneName('')

    const tempZone: LocalZone = { id: '', name, display_order: zones.length, color: DEFAULT_COLOR, saving: true }
    const optimisticZones = [...zones, tempZone]
    setZones(optimisticZones)
    setZonePersisting(true)

    try {
      const refreshed = await patchZonesAndRefresh(
        optimisticZones.map((z, i) => ({ name: z.name, display_order: i, color: z.color }))
      )
      const serverZones = refreshed.zones.filter((z) => !z.deleted_at)
      setZones((prev) =>
        prev.map((z) => {
          if (z.id !== '') return { ...z, saving: false }
          const server = serverZones.find((sz) => sz.name === z.name)
          return server
            ? { id: server.id, name: server.name, display_order: server.display_order, color: server.color, saving: false }
            : z
        })
      )
    } catch {
      setZones((prev) => prev.filter((z) => z.id !== ''))
      setZoneError(t('errors.zoneSaveFailed'))
    } finally {
      setZonePersisting(false)
    }
  }, [zones, newZoneName, t])

  const handleRemoveZone = useCallback(async (zoneId: string) => {
    const nextZones = zones.filter((z) => z.id !== zoneId)
    const nextTables = tables.filter((t) => t.zone_id !== zoneId)
    setZones(nextZones)
    setTables(nextTables)
    try {
      await saveNow({
        zones: nextZones.map((z, i) => ({ name: z.name, display_order: i, color: z.color })),
        tables: nextTables.map((t) => ({ zone_id: t.zone_id, label: t.label, seats: t.seats, is_bookable: t.is_bookable, is_qr_enabled: t.is_qr_enabled })),
      })
    } catch {
      // surfaced via saveState
    }
  }, [zones, tables, saveNow])

  // ---- Table actions ---------------------------------------------------------

  const handleAddTable = useCallback((zoneId: string) => {
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
      tables: nextTables.map((t) => ({ zone_id: t.zone_id, label: t.label, seats: t.seats, is_bookable: t.is_bookable, is_qr_enabled: t.is_qr_enabled })),
    })
  }, [tables, selectedSize, save])

  const handleRemoveTable = useCallback((label: string) => {
    const nextTables = tables.filter((t) => t.label !== label)
    setTables(nextTables)
    save({
      tables: nextTables.map((t) => ({ zone_id: t.zone_id, label: t.label, seats: t.seats, is_bookable: t.is_bookable, is_qr_enabled: t.is_qr_enabled })),
    })
  }, [tables, save])

  // ---- Occupancy / turnover --------------------------------------------------

  const handleOccupancyChange = useCallback((val: string) => {
    if (val === 'per_party') {
      setOccupancyMode('per_party')
      const parsed = buildPartyMap(partyDurations)
      save({ restaurant: { occupancy_duration_by_party: parsed } })
    } else {
      const minutes = parseInt(val, 10)
      setOccupancyMinutes(minutes)
      setOccupancyMode('fixed')
      save({ restaurant: { occupancy_duration_minutes: minutes, occupancy_duration_by_party: {} } })
    }
  }, [partyDurations, save])

  const handlePartyDurationChange = useCallback((size: string, val: string) => {
    const next = { ...partyDurations, [size]: val }
    setPartyDurations(next)
    const parsed = buildPartyMap(next)
    if (Object.keys(parsed).length > 0) {
      save({ restaurant: { occupancy_duration_by_party: parsed } })
    }
  }, [partyDurations, save])

  const handleTurnoverChange = useCallback((val: string) => {
    const minutes = parseInt(val, 10)
    setTurnoverMinutes(minutes)
    save({ restaurant: { turnover_buffer_minutes: minutes } })
  }, [save])

  // ---- Continue --------------------------------------------------------------

  const handleContinue = useCallback(async () => {
    if (isContinuing) return
    setIsContinuing(true)
    try {
      const currIdx = visibleStepIds.indexOf(2)
      const nextStepId = currIdx >= 0 && currIdx < visibleStepIds.length - 1
        ? visibleStepIds[currIdx + 1]!
        : 3
      const nextPath = stepPath(nextStepId, locale)
      await saveNow({ restaurant: { current_onboarding_step: nextStepId } })
      if (nextPath) router.push(nextPath)
    } catch {
      // surfaced via saveState
    } finally {
      setIsContinuing(false)
    }
  }, [isContinuing, visibleStepIds, locale, saveNow, router])

  // ---- Derived ---------------------------------------------------------------

  const totalTables = tables.length
  const totalSeats = tables.reduce((sum, t) => sum + t.seats, 0)
  const totalZones = zones.length
  const maxPerShift = totalSeats

  const canContinue = totalZones >= 1 && totalTables >= 1 && !isContinuing && !zonePersisting
  const backHref = previousStepPath(2, visibleStepIds, locale) ?? stepPath(1, locale)

  const occupancySelectValue = occupancyMode === 'per_party' ? 'per_party' : String(occupancyMinutes)
  const occupancyOptions = [
    ...OCCUPANCY_OPTIONS_MINS.map((m) => ({ value: String(m), label: `${m} ${t('minutesSuffix')}` })),
    { value: 'per_party', label: t('occupancyPerParty') },
  ]
  const turnoverOptions = TURNOVER_OPTIONS_MINS.map((m) => ({
    value: String(m), label: `${m} ${t('minutesSuffix')}`,
  }))

  // ---- Shared label style ----------------------------------------------------

  const sectionLabel: React.CSSProperties = {
    fontFamily: 'var(--font-jost), Jost, sans-serif',
    fontWeight: 700,
    fontSize: '12px',
    letterSpacing: '0.13em',
    textTransform: 'uppercase',
    color: '#9a8259',
    margin: 0,
  }

  // ---- Render ----------------------------------------------------------------

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
      isSubmitting={isContinuing}
      continueLabel={t('continueLabel')}
      onContinue={handleContinue}
      error={hydrationError}
      onDismissError={() => setHydrationError(null)}
      savedIndicator={<SavedIndicator state={saveState} locale={locale} />}
    >
      <style>{`
        @media (max-width: 680px) {
          .fp-stats-grid { grid-template-columns: 1fr 1fr !important; }
          .fp-dropdown-row { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* ── Header band ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '40px',
        gap: '16px',
      }}>
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
            <span style={{ width: 6, height: 6, borderRadius: '9999px', backgroundColor: 'var(--amber)', flexShrink: 0, display: 'inline-block' }} />
            {locale === 'en'
              ? `Step ${currentDisplayNum} of ${totalSteps} — Reservations`
              : `Stap ${currentDisplayNum} van ${totalSteps} — Reserveringen`}
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
            {t('heading')}
            <span style={{ color: 'var(--amber)' }}>.</span>
          </h1>

          {/* Description */}
          <p style={{
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontWeight: 400,
            fontSize: '16px',
            lineHeight: 1.5,
            color: 'var(--stone)',
            maxWidth: '520px',
            margin: 0,
          }}>
            {t('sub')}
          </p>
        </div>

        {/* Counter + progress segments */}
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
            <span style={{ fontSize: '17px', color: 'var(--stone-dim)', letterSpacing: '-0.01em' }}>
              /{String(totalSteps).padStart(2, '0')}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '3px', justifyContent: 'flex-end', marginTop: '10px' }}>
            {Array.from({ length: totalSteps }, (_, i) => {
              const n = i + 1
              const isCurrent = n === currentDisplayNum
              const isDone = n < currentDisplayNum
              return (
                <div key={i} style={{
                  width: 7, height: 7, borderRadius: 2,
                  backgroundColor: isCurrent ? 'var(--sage)' : isDone ? 'var(--amber)' : 'var(--cream-border)',
                }} />
              )
            })}
          </div>
        </div>
      </div>

      {hydrating ? (
        <div style={{ color: 'var(--stone)', fontFamily: 'var(--font-jost), sans-serif', fontSize: '14px' }}>
          {t('loading')}
        </div>
      ) : (
        <>
          {/* ── Stats grid ─────────────────────────────────────────────────── */}
          <div
            className="fp-stats-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
              marginBottom: '38px',
            }}
          >
            <StatCard
              value={totalTables}
              label={t('tiles.tables')}
              tileBg="var(--amber-bg)"
              tileColor="var(--amber-deep)"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 10h18" />
                </svg>
              }
            />
            <StatCard
              value={totalSeats}
              label={t('tiles.seats')}
              tileBg="var(--burgundy-bg)"
              tileColor="var(--burgundy)"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 10V6a2 2 0 012-2h8a2 2 0 012 2v4M5 10h14v5H5zM7 15v4M17 15v4" />
                </svg>
              }
            />
            <StatCard
              value={totalZones}
              label={t('tiles.zones')}
              tileBg="var(--sage-bg)"
              tileColor="var(--sage)"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 3l8 4-8 4-8-4 8-4zM4 12l8 4 8-4M4 17l8 4 8-4" />
                </svg>
              }
            />
            <StatCard
              value={maxPerShift}
              label={t('tiles.maxPerShift')}
              tileBg="var(--amber-bg)"
              tileColor="var(--amber-deep)"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="8" r="3" />
                  <path d="M3 19a6 6 0 0112 0M16 6a3 3 0 010 6M18 19a5 5 0 00-3-4.6" />
                </svg>
              }
            />
          </div>

          {/* ── Size chips ─────────────────────────────────────────────────── */}
          <div style={{ marginBottom: '36px' }}>
            <div style={{ ...sectionLabel, marginBottom: '14px' }}>{t('sizeSelector')}</div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {TABLE_SIZES.map((size) => {
                const active = selectedSize === size
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setSelectedSize(size)}
                    style={{
                      width: 64,
                      height: 48,
                      borderRadius: '9999px',
                      border: active ? '2px solid var(--amber)' : '1.5px solid var(--cream-border)',
                      backgroundColor: active ? 'var(--amber-bg)' : 'var(--cream-card)',
                      color: active ? 'var(--amber-deep)' : 'var(--stone)',
                      fontFamily: 'var(--font-jost), Jost, sans-serif',
                      fontWeight: 700,
                      fontSize: '16px',
                      cursor: 'pointer',
                      transition: 'all 120ms ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {size}p
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Zones section ──────────────────────────────────────────────── */}
          <div>
            {/* Zones header row */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '14px',
            }}>
              <div style={sectionLabel}>Zones</div>
              {!isAddingZone && (
                <button
                  type="button"
                  onClick={() => { setIsAddingZone(true); setNewZoneName(''); setZoneError(null) }}
                  disabled={zonePersisting}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '4px 0',
                    cursor: zonePersisting ? 'not-allowed' : 'pointer',
                    fontFamily: 'var(--font-jost), Jost, sans-serif',
                    fontSize: '14px',
                    fontWeight: 700,
                    color: zonePersisting ? 'var(--stone)' : 'var(--amber)',
                    opacity: zonePersisting ? 0.5 : 1,
                    transition: 'opacity 150ms ease',
                  }}
                >
                  {t('addZone')}
                </button>
              )}
            </div>

            {/* Inline zone-name input */}
            {isAddingZone && (
              <div style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                marginBottom: '20px',
                flexWrap: 'wrap',
              }}>
                <input
                  type="text"
                  autoFocus
                  value={newZoneName}
                  onChange={(e) => { setNewZoneName(e.target.value); setZoneError(null) }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); void handleAddZoneConfirm() }
                    if (e.key === 'Escape') { setIsAddingZone(false); setNewZoneName(''); setZoneError(null) }
                  }}
                  placeholder={t('zoneNamePlaceholder')}
                  maxLength={100}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '12px',
                    border: `1.5px solid ${zoneError ? '#ef4444' : 'rgba(212, 130, 10, 0.4)'}`,
                    backgroundColor: 'var(--cream-card)',
                    fontFamily: 'var(--font-jost), Jost, sans-serif',
                    fontSize: '14px',
                    color: 'var(--earth)',
                    outline: 'none',
                    width: '220px',
                    boxSizing: 'border-box',
                  }}
                />
                <button
                  type="button"
                  onClick={() => void handleAddZoneConfirm()}
                  style={{
                    padding: '12px 18px',
                    borderRadius: '12px',
                    border: 'none',
                    backgroundColor: 'var(--amber)',
                    color: '#fffefb',
                    fontFamily: 'var(--font-jost), Jost, sans-serif',
                    fontSize: '13px',
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {t('confirmZone')}
                </button>
                <button
                  type="button"
                  onClick={() => { setIsAddingZone(false); setNewZoneName(''); setZoneError(null) }}
                  style={{
                    padding: '12px 18px',
                    borderRadius: '12px',
                    border: '1.5px solid var(--cream-border)',
                    backgroundColor: 'transparent',
                    color: 'var(--stone)',
                    fontFamily: 'var(--font-jost), Jost, sans-serif',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  {t('cancelZone')}
                </button>
              </div>
            )}

            {zoneError && (
              <div style={{
                marginBottom: '16px',
                fontFamily: 'var(--font-jost), Jost, sans-serif',
                fontSize: '13px',
                color: '#dc2626',
              }}>
                {zoneError}
              </div>
            )}

            {/* Zone cards */}
            {zones.map((zone) => (
              <ZoneCardV2
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

          {/* ── Occupancy + turnover dropdowns ──────────────────────────────── */}
          <div
            className="fp-dropdown-row"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '22px',
            }}
          >
            <StyledSelect
              label={t('occupancyLabel')}
              value={occupancySelectValue}
              onChange={handleOccupancyChange}
              options={occupancyOptions}
            />
            <StyledSelect
              label={t('turnoverLabel')}
              value={String(turnoverMinutes)}
              onChange={handleTurnoverChange}
              options={turnoverOptions}
            />
          </div>

          {/* Per-party size grid */}
          {occupancyMode === 'per_party' && (
            <div style={{ paddingLeft: '2px', marginTop: '24px' }}>
              <div style={{ ...sectionLabel, marginBottom: '12px' }}>
                {t('partyGridLabel')}
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))',
                gap: '12px',
              }}>
                {PARTY_SIZES.map((size) => (
                  <div key={size}>
                    <div style={{
                      fontFamily: 'var(--font-jost), sans-serif',
                      fontSize: '11px',
                      color: 'var(--stone)',
                      marginBottom: '6px',
                    }}>
                      {size} {t('partySize')}
                    </div>
                    <input
                      type="number"
                      min="15"
                      max="600"
                      value={partyDurations[size] ?? ''}
                      onChange={(e) => handlePartyDurationChange(size, e.target.value)}
                      placeholder="—"
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: '1.5px solid var(--cream-border)',
                        backgroundColor: 'var(--cream-card)',
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
        </>
      )}
    </StepFrame>
  )
}
