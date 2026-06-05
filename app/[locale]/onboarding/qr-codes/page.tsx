'use client'

import { useState, useEffect } from 'react'
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

type Zone = {
  id: string
  name: string
  color: string | null
  display_order: number
}

type TableRow = {
  id: string
  zone_id: string
  label: string
  seats: number
  is_qr_enabled: boolean
  qr_token: string | null
  qr_image_path: string | null
}

// ---- Style helpers ----------------------------------------------------------

const zoneHeadingStyle: React.CSSProperties = {
  fontFamily: 'var(--font-jost), Jost, sans-serif',
  fontWeight: 600,
  fontSize: '15px',
  color: '#1e1508',
  marginBottom: '12px',
  display: 'flex',
  alignItems: 'center',
}

const linkButtonStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  padding: 0,
  cursor: 'pointer',
  color: '#d4820a',
  fontFamily: 'var(--font-jost), Jost, sans-serif',
  fontSize: '12px',
  textDecoration: 'underline',
}

// ---- EmptyState (inline) ----------------------------------------------------

function EmptyState({ t }: { t: ReturnType<typeof useTranslations<'onboarding.qrCodes'>> }) {
  return (
    <div style={{
      padding: '40px',
      background: '#f8f2e6',
      borderRadius: '12px',
      textAlign: 'center',
    }}>
      <div style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontSize: '16px', color: '#1e1508', marginBottom: '12px' }}>
        {t('emptyStateTitle')}
      </div>
      <p style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontSize: '14px', color: '#9c8b6a', lineHeight: 1.6, margin: 0 }}>
        {t('emptyStateBody')}
      </p>
    </div>
  )
}

// ---- TableCard (inline) -----------------------------------------------------

function TableCard({
  table,
  isToggling,
  isRegenerating,
  thumbnailUrl,
  onToggle,
  onDownload,
  onRegenerate,
  t,
}: {
  table: TableRow
  isToggling: boolean
  isRegenerating: boolean
  thumbnailUrl: string | undefined
  onToggle: (next: boolean) => void
  onDownload: () => void
  onRegenerate: () => void
  t: ReturnType<typeof useTranslations<'onboarding.qrCodes'>>
}) {
  const toggleRow = (
    <label style={{
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      cursor: isToggling ? 'wait' : 'pointer',
      fontFamily: 'var(--font-jost), Jost, sans-serif',
      fontSize: '13px',
      color: '#1e1508',
    }}>
      <span style={{
        position: 'relative',
        width: '36px',
        height: '20px',
        background: table.is_qr_enabled ? '#d4820a' : '#9c8b6a',
        borderRadius: '999px',
        transition: 'background 120ms ease',
        flexShrink: 0,
      }}>
        <span style={{
          position: 'absolute',
          top: '2px',
          left: table.is_qr_enabled ? '18px' : '2px',
          width: '16px',
          height: '16px',
          background: 'white',
          borderRadius: '50%',
          transition: 'left 120ms ease',
        }} />
      </span>
      <input
        type="checkbox"
        checked={table.is_qr_enabled}
        onChange={(e) => onToggle(e.target.checked)}
        disabled={isToggling}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
      />
      {t('qrEnabledLabel')}
    </label>
  )

  return (
    <div style={{
      padding: '16px 18px',
      background: '#f8f2e6',
      borderRadius: '12px',
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      opacity: isToggling ? 0.7 : 1,
      transition: 'opacity 120ms ease',
    }}>
      {table.qr_token ? (
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          {/* Thumbnail */}
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '6px',
            background: '#fdfaf5',
            flexShrink: 0,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            {thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={thumbnailUrl}
                alt=""
                style={{ width: '80px', height: '80px', objectFit: 'contain' }}
              />
            ) : (
              <div style={{ width: '80px', height: '80px', background: 'rgba(156,139,106,0.15)', borderRadius: '6px' }} />
            )}
          </div>

          {/* Right column */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600, fontSize: '15px', color: '#1e1508' }}>
                {table.label}
              </div>
              <div style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontSize: '12px', color: '#9c8b6a' }}>
                {table.seats} {t('seats')}
              </div>
            </div>
            {toggleRow}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={onDownload} style={linkButtonStyle}>{t('download')}</button>
              <button
                onClick={onRegenerate}
                disabled={isRegenerating}
                style={{ ...linkButtonStyle, color: isRegenerating ? '#9c8b6a' : '#d4820a' }}
              >
                {isRegenerating ? t('regenerating') : t('regenerate')}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600, fontSize: '15px', color: '#1e1508' }}>
              {table.label}
            </div>
            <div style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontSize: '12px', color: '#9c8b6a' }}>
              {table.seats} {t('seats')}
            </div>
          </div>
          {toggleRow}
        </>
      )}
    </div>
  )
}

// ---- Page -------------------------------------------------------------------

export default function QrCodesPage() {
  const t = useTranslations('onboarding.qrCodes')
  const params = useParams()
  const locale: 'nl' | 'en' = (params?.locale as string) === 'en' ? 'en' : 'nl'
  const router = useRouter()
  const pathname = usePathname()
  const { state: saveState, saveNow } = useDraftSave()

  // Wizard meta
  const [totalSteps, setTotalSteps] = useState(14)
  const [visibleStepIds, setVisibleStepIds] = useState<number[]>([])
  const [currentDisplayNum, setCurrentDisplayNum] = useState(10)

  // Page state
  const [zones, setZones] = useState<Zone[]>([])
  const [tables, setTables] = useState<TableRow[]>([])
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set())
  const [tableUpdateError, setTableUpdateError] = useState<string | null>(null)

  const [hydrated, setHydrated] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Generation / download state
  const [isGenerating, setIsGenerating] = useState(false)
  const [isDownloadingAll, setIsDownloadingAll] = useState(false)
  const [regeneratingIds, setRegeneratingIds] = useState<Set<string>>(new Set())
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({})
  const [actionError, setActionError] = useState<string | null>(null)

  // ---- Hydration -------------------------------------------------------------

  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      try {
        const res = await fetch('/api/v1/restaurants/draft', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (cancelled) return

        const r = (data?.restaurant ?? {}) as Record<string, unknown>

        try {
          const visibleSteps = getVisibleSteps(
            r as Parameters<typeof getVisibleSteps>[0]
          )
          setTotalSteps(getTotalWizardSteps(visibleSteps))
          setVisibleStepIds(visibleSteps.map((s) => s.id))
          setCurrentDisplayNum(getDisplayedStepNumber(10, visibleSteps) ?? 10)
        } catch {
          // leave defaults
        }

        const zonesArr = Array.isArray(data?.zones) ? data.zones : []
        const tablesArr = Array.isArray(data?.tables) ? data.tables : []

        setZones(
          zonesArr
            .filter((z: any) => !z.deleted_at)
            .map((z: any) => ({
              id: z.id,
              name: z.name,
              color: z.color ?? null,
              display_order: z.display_order ?? 0,
            }))
            .sort((a: Zone, b: Zone) => a.display_order - b.display_order)
        )
        setTables(
          tablesArr
            .filter((tbl: any) => !tbl.deleted_at)
            .map((tbl: any) => ({
              id: tbl.id,
              zone_id: tbl.zone_id,
              label: tbl.label,
              seats: tbl.seats,
              is_qr_enabled: tbl.is_qr_enabled ?? true,
              qr_token: tbl.qr_token ?? null,
              qr_image_path: tbl.qr_image_path ?? null,
            }))
        )
        if (!cancelled) setHydrated(true)
      } catch {
        // swallow
      }
    }
    void hydrate()
    return () => {
      cancelled = true
    }
  }, [pathname])

  // ---- Fetch thumbnails after hydration -------------------------------------

  useEffect(() => {
    if (!hydrated) return
    const tablesWithQr = tables.filter((tr) => tr.qr_image_path && !thumbnailUrls[tr.id])
    if (tablesWithQr.length === 0) return
    ;(async () => {
      const updates: Record<string, string> = {}
      await Promise.all(
        tablesWithQr.map(async (tr) => {
          try {
            const res = await fetch(`/api/v1/restaurants/qr/download/${tr.id}`)
            if (!res.ok) return
            const data = await res.json()
            if (typeof data.url === 'string') updates[tr.id] = data.url
          } catch {
            // skip
          }
        })
      )
      if (Object.keys(updates).length > 0) {
        setThumbnailUrls((prev) => ({ ...prev, ...updates }))
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, tables])

  // ---- Toggle handler -------------------------------------------------------

  async function handleQrToggle(tableId: string, nextValue: boolean) {
    if (!hydrated || togglingIds.has(tableId)) return

    setTableUpdateError(null)
    setTogglingIds((prev) => new Set(prev).add(tableId))
    const prevTables = tables
    setTables((prev) =>
      prev.map((tr) => (tr.id === tableId ? { ...tr, is_qr_enabled: nextValue } : tr))
    )

    try {
      const res = await fetch(`/api/v1/restaurants/tables/${tableId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_qr_enabled: nextValue }),
      })
      if (!res.ok) {
        setTables(prevTables)
        setTableUpdateError(t('toggleError'))
      } else {
        const data = await res.json()
        if (data?.table?.id) {
          setTables((prev) =>
            prev.map((tr) => (tr.id === data.table.id ? { ...tr, ...data.table } : tr))
          )
        }
      }
    } catch {
      setTables(prevTables)
      setTableUpdateError(t('toggleError'))
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev)
        next.delete(tableId)
        return next
      })
    }
  }

  // ---- Generate handler -----------------------------------------------------

  async function handleGenerate(regenerateAll: boolean) {
    if (isGenerating) return
    setIsGenerating(true)
    setActionError(null)
    try {
      const body: Record<string, unknown> = {}
      if (regenerateAll) {
        body.regenerate = true
        body.table_ids = tables.filter((t) => t.is_qr_enabled).map((t) => t.id)
      }
      const res = await fetch('/api/v1/restaurants/qr/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('generate_failed')
      const data = await res.json()
      if (Array.isArray(data.updated_tables)) {
        setTables((prev) =>
          prev.map((tr) => {
            const upd = data.updated_tables.find((u: any) => u.id === tr.id)
            return upd ? { ...tr, qr_token: upd.qr_token, qr_image_path: upd.qr_image_path } : tr
          })
        )
        // Clear cached thumbnails so they refresh via the effect
        setThumbnailUrls({})
      }
    } catch {
      setActionError(t('generateError'))
    } finally {
      setIsGenerating(false)
    }
  }

  // ---- Download all ---------------------------------------------------------

  function handleDownloadAll() {
    if (isDownloadingAll) return
    setIsDownloadingAll(true)
    setActionError(null)
    window.location.href = '/api/v1/restaurants/qr/download-all'
    setTimeout(() => setIsDownloadingAll(false), 1500)
  }

  // ---- Download single ------------------------------------------------------

  async function handleDownloadSingle(tableId: string) {
    try {
      const res = await fetch(`/api/v1/restaurants/qr/download/${tableId}`)
      if (!res.ok) {
        setActionError(t('downloadError'))
        return
      }
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch {
      setActionError(t('downloadError'))
    }
  }

  // ---- Regenerate single ----------------------------------------------------

  async function handleRegenerate(tableId: string) {
    if (regeneratingIds.has(tableId)) return
    setRegeneratingIds((prev) => new Set(prev).add(tableId))
    setActionError(null)
    try {
      const res = await fetch('/api/v1/restaurants/qr/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ table_ids: [tableId], regenerate: true }),
      })
      if (!res.ok) throw new Error('regen_failed')
      const data = await res.json()
      const upd = Array.isArray(data.updated_tables) ? data.updated_tables[0] : null
      if (upd) {
        setTables((prev) =>
          prev.map((tr) => (tr.id === upd.id ? { ...tr, qr_token: upd.qr_token, qr_image_path: upd.qr_image_path } : tr))
        )
        setThumbnailUrls((prev) => {
          const next = { ...prev }
          delete next[tableId]
          return next
        })
      }
    } catch {
      setActionError(t('regenerateError'))
    } finally {
      setRegeneratingIds((prev) => {
        const next = new Set(prev)
        next.delete(tableId)
        return next
      })
    }
  }

  // ---- Continue handler -----------------------------------------------------

  async function handleContinue() {
    if (submitting) return
    setSubmitting(true)
    setSubmitError(null)
    try {
      const currIdx = visibleStepIds.indexOf(10)
      const nextStepId =
        currIdx >= 0 && currIdx < visibleStepIds.length - 1
          ? visibleStepIds[currIdx + 1]!
          : 11
      await saveNow({
        restaurant: { current_onboarding_step: nextStepId },
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

  const backHref = previousStepPath(10, visibleStepIds, locale) ?? stepPath(9, locale)
  const pendingGenerationCount = tables.filter((tr) => tr.is_qr_enabled && !tr.qr_token).length
  const hasAnyGenerated = tables.some((tr) => tr.qr_token)
  const showRegenerateAll = pendingGenerationCount === 0 && hasAnyGenerated

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

        {/* Action error */}
        {actionError && (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(239,68,68,0.08)',
            borderRadius: '8px',
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontSize: '13px',
            color: '#c64a4a',
          }}>
            {actionError}
          </div>
        )}

        {/* Generate / Download-all toolbar */}
        {tables.length > 0 && (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {(pendingGenerationCount > 0 || showRegenerateAll) && (
              <button
                type="button"
                onClick={() => void handleGenerate(showRegenerateAll)}
                disabled={isGenerating}
                style={{
                  padding: '10px 20px',
                  borderRadius: '999px',
                  border: 'none',
                  background: isGenerating ? '#9c8b6a' : '#d4820a',
                  color: '#fff',
                  fontFamily: 'var(--font-jost), Jost, sans-serif',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: isGenerating ? 'not-allowed' : 'pointer',
                  transition: 'background 120ms ease',
                }}
              >
                {isGenerating
                  ? t('generating')
                  : showRegenerateAll
                    ? t('regenerateAllButton')
                    : t('generateButton', { count: pendingGenerationCount })}
              </button>
            )}

            {hasAnyGenerated && (
              <button
                type="button"
                onClick={handleDownloadAll}
                disabled={isDownloadingAll}
                style={{
                  padding: '10px 20px',
                  borderRadius: '999px',
                  border: '1.5px solid rgba(212,130,10,0.4)',
                  background: 'transparent',
                  color: '#d4820a',
                  fontFamily: 'var(--font-jost), Jost, sans-serif',
                  fontWeight: 600,
                  fontSize: '14px',
                  cursor: isDownloadingAll ? 'not-allowed' : 'pointer',
                }}
              >
                {isDownloadingAll ? t('downloadingAll') : t('downloadAllButton')}
              </button>
            )}
          </div>
        )}

        {/* Toggle error */}
        {tableUpdateError && (
          <div style={{
            padding: '12px 16px',
            background: 'rgba(239,68,68,0.08)',
            borderRadius: '8px',
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontSize: '13px',
            color: '#c64a4a',
          }}>
            {tableUpdateError}
          </div>
        )}

        {/* Tables section */}
        <section>
          {tables.length === 0 ? (
            <EmptyState t={t} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {zones.map((zone) => {
                const zoneTables = tables.filter((tr) => tr.zone_id === zone.id)
                if (zoneTables.length === 0) return null
                return (
                  <div key={zone.id}>
                    <h3 style={zoneHeadingStyle}>
                      <span style={{
                        display: 'inline-block',
                        width: '10px',
                        height: '10px',
                        borderRadius: '50%',
                        background: zone.color ?? '#d4820a',
                        marginRight: '8px',
                        flexShrink: 0,
                      }} />
                      {zone.name}
                    </h3>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
                      gap: '12px',
                    }}>
                      {zoneTables.map((tr) => (
                        <TableCard
                          key={tr.id}
                          table={tr}
                          isToggling={togglingIds.has(tr.id)}
                          isRegenerating={regeneratingIds.has(tr.id)}
                          thumbnailUrl={thumbnailUrls[tr.id]}
                          onToggle={(next) => void handleQrToggle(tr.id, next)}
                          onDownload={() => void handleDownloadSingle(tr.id)}
                          onRegenerate={() => void handleRegenerate(tr.id)}
                          t={t}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

      </div>
    </StepFrame>
  )
}
