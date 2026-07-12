'use client'

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter } from '@/i18n/routing'

const TZ = 'Europe/Amsterdam'

type Slot = {
  instant: string
  isSoonestAvailable: boolean
  full: boolean
  backlogCount: number
}

type ApiResponse =
  | {
      ok: true
      available: true
      windowStatus: 'open_now' | 'closed_today'
      scheduledAllowed: boolean
      windowOpenInstant: string
      windowCloseInstant: string
      slots: Slot[]
      earliestPickupInstant: string | null
      latestPickupInstant: string | null
    }
  | {
      ok: true
      available: false
      reason: 'service_disabled' | 'not_accepting_orders' | 'no_upcoming_hours' | 'no_slots_available'
    }
  | { ok: false; error: string }

type Props = {
  slug: string
  locale: 'nl' | 'en'
}

const UNAVAILABLE_KEY: Record<
  'service_disabled' | 'not_accepting_orders' | 'no_upcoming_hours' | 'no_slots_available',
  string
> = {
  service_disabled: 'unavailable.serviceDisabled',
  not_accepting_orders: 'unavailable.notAcceptingOrders',
  no_upcoming_hours: 'unavailable.noUpcomingHours',
  no_slots_available: 'unavailable.noSlotsAvailable',
}

function formatHHmm(iso: string, locale: 'nl' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

function formatHour(iso: string, locale: 'nl' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', {
    timeZone: TZ,
    hour: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

function amsterdamYmd(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(iso))
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value])) as Record<string, string>
  return `${map.year}-${map.month}-${map.day}`
}

export function PickupTimePicker({ slug, locale }: Props) {
  const t = useTranslations('consumer.takeaway.pickup')
  const router = useRouter()
  const [data, setData] = useState<ApiResponse | null>(null)
  const [fetchFailed, setFetchFailed] = useState(false)
  const [selectedInstant, setSelectedInstant] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(`/api/v1/public/${encodeURIComponent(slug)}/pickup-slots`, {
          cache: 'no-store',
        })
        const json = (await res.json()) as ApiResponse
        if (!cancelled) {
          setData(json)
          if (json.ok && json.available) {
            setSelectedInstant(json.earliestPickupInstant ?? null)
          }
        }
      } catch (err) {
        console.error('[PickupTimePicker] fetch failed', err)
        if (!cancelled) setFetchFailed(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug])

  const groupedByHour = useMemo(() => {
    if (!data || !data.ok || !data.available) return []
    const map = new Map<string, Slot[]>()
    for (const s of data.slots) {
      const hourKey = formatHour(s.instant, locale)
      const arr = map.get(hourKey) ?? []
      arr.push(s)
      map.set(hourKey, arr)
    }
    return Array.from(map.entries()).map(([hour, slots]) => ({ hour, slots }))
  }, [data, locale])

  const todayYmd = useMemo(() => {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date())
    const map = Object.fromEntries(parts.map((p) => [p.type, p.value])) as Record<string, string>
    return `${map.year}-${map.month}-${map.day}`
  }, [])

  function dayLabelFor(iso: string): string {
    return amsterdamYmd(iso) === todayYmd ? t('todayLabel') : t('tomorrowLabel')
  }

  function handleConfirm() {
    if (!selectedInstant) return
    router.push(`/r/${slug}/order/details?pickup=${encodeURIComponent(selectedInstant)}`)
  }

  // ── Loading / error / unavailable ──────────────────────────────────────
  if (fetchFailed) {
    return (
      <div style={{ padding: '32px 24px', textAlign: 'center' }}>
        <p style={panelText}>{t('fetchError')}</p>
      </div>
    )
  }
  if (!data) {
    return (
      <div style={{ padding: '32px 24px', textAlign: 'center' }}>
        <p style={panelText}>{t('loading')}</p>
      </div>
    )
  }
  if (!data.ok) {
    return (
      <div style={{ padding: '32px 24px', textAlign: 'center' }}>
        <p style={panelText}>{t('fetchError')}</p>
      </div>
    )
  }
  if (!data.available) {
    const heading = t(UNAVAILABLE_KEY[data.reason])
    return (
      <div style={{ padding: '32px 24px', textAlign: 'center' }}>
        <p style={panelText}>{heading}</p>
      </div>
    )
  }

  // ── ASAP mode ────────────────────────────────────────────────────────────
  if (!data.scheduledAllowed) {
    const asapInstant = data.earliestPickupInstant
    if (!asapInstant) {
      return (
        <div style={{ padding: '32px 24px', textAlign: 'center' }}>
          <p style={panelText}>{t(UNAVAILABLE_KEY.no_slots_available)}</p>
        </div>
      )
    }
    const hhmm = formatHHmm(asapInstant, locale)
    const dayLabel = dayLabelFor(asapInstant)
    return (
      <div style={{ padding: '32px 24px' }}>
        <h1 style={headingStyle}>{t('asapHeading')}</h1>
        <div style={asapCardStyle}>
          <p style={asapPillStyle}>{t('asapPill')}</p>
          <p style={asapTimeStyle}>{t('asapCta', { time: hhmm, day: dayLabel })}</p>
        </div>
        <button type="button" onClick={handleConfirm} className="tafel-tap" style={continueButtonStyle}>
          {t('continueCta')}
        </button>
      </div>
    )
  }

  // ── Scheduled grid ──────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 20px 40px' }}>
      <h1 style={headingStyle}>{t('scheduledHeading')}</h1>
      <p style={subheadingStyle}>{t('scheduledSub')}</p>
      <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {groupedByHour.map((group) => (
          <section key={group.hour}>
            <p style={hourLabelStyle}>{group.hour}:00</p>
            <div style={chipRowStyle}>
              {group.slots.map((slot) => {
                const isSelected = slot.instant === selectedInstant
                const disabled = slot.full
                return (
                  <button
                    key={slot.instant}
                    type="button"
                    disabled={disabled}
                    onClick={() => setSelectedInstant(slot.instant)}
                    className="tafel-tap"
                    style={{
                      ...chipStyle,
                      backgroundColor: isSelected ? 'var(--amber, #d4820a)' : disabled ? '#efe8db' : '#fff',
                      color: isSelected ? '#fff' : disabled ? '#a89f8f' : 'var(--night, #0f0d08)',
                      borderColor: isSelected ? 'var(--amber, #d4820a)' : 'rgba(15,13,8,0.1)',
                    }}
                  >
                    <span>{formatHHmm(slot.instant, locale)}</span>
                    {slot.isSoonestAvailable && !disabled ? (
                      <span style={soonestPillStyle}>{t('soonestPill')}</span>
                    ) : null}
                    {disabled ? <span style={soonestPillStyle}>{t('full')}</span> : null}
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
      <button
        type="button"
        onClick={handleConfirm}
        disabled={!selectedInstant}
        className="tafel-tap"
        style={{
          ...continueButtonStyle,
          opacity: selectedInstant ? 1 : 0.5,
        }}
      >
        {t('continueCta')}
      </button>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────
const panelText: CSSProperties = {
  fontFamily: 'var(--font-jost), sans-serif',
  fontSize: '15px',
  color: 'var(--stone, #7a7264)',
  lineHeight: 1.5,
  margin: 0,
}

const headingStyle: CSSProperties = {
  fontFamily: 'var(--font-raleway), serif',
  fontWeight: 900,
  fontSize: 'clamp(26px, 5vw, 32px)',
  color: 'var(--night, #0f0d08)',
  margin: 0,
}

const subheadingStyle: CSSProperties = {
  fontFamily: 'var(--font-jost), sans-serif',
  fontWeight: 400,
  fontSize: '15px',
  color: 'var(--stone, #7a7264)',
  margin: '8px 0 0 0',
}

const asapCardStyle: CSSProperties = {
  marginTop: '24px',
  backgroundColor: '#fef3e2',
  color: '#8a4a08',
  borderRadius: '16px',
  padding: '24px',
  textAlign: 'center',
}

const asapPillStyle: CSSProperties = {
  fontFamily: 'var(--font-jost), sans-serif',
  fontWeight: 600,
  fontSize: '12px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  margin: 0,
  opacity: 0.8,
}

const asapTimeStyle: CSSProperties = {
  fontFamily: 'var(--font-raleway), serif',
  fontWeight: 900,
  fontSize: 'clamp(24px, 5vw, 30px)',
  margin: '12px 0 0 0',
  lineHeight: 1.2,
}

const hourLabelStyle: CSSProperties = {
  fontFamily: 'var(--font-jost), sans-serif',
  fontWeight: 600,
  fontSize: '12px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#a86205',
  margin: '0 0 12px 0',
}

const chipRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))',
  gap: '10px',
}

const chipStyle: CSSProperties = {
  border: '1.5px solid',
  borderRadius: '12px',
  padding: '12px 8px',
  fontFamily: 'var(--font-jost), sans-serif',
  fontWeight: 600,
  fontSize: '15px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: '4px',
  transition: 'background-color 0.15s',
}

const soonestPillStyle: CSSProperties = {
  fontFamily: 'var(--font-jost), sans-serif',
  fontWeight: 600,
  fontSize: '10px',
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  opacity: 0.85,
}

const continueButtonStyle: CSSProperties = {
  marginTop: '32px',
  width: '100%',
  backgroundColor: 'var(--amber, #d4820a)',
  color: '#fff',
  fontFamily: 'var(--font-jost), sans-serif',
  fontWeight: 600,
  fontSize: '16px',
  padding: '16px 24px',
  borderRadius: '12px',
  border: 'none',
}
