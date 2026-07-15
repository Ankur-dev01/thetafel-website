'use client'

// Duplicate of components/consumer/qr/OrderStatus.tsx with a different
// translation namespace (consumer.takeaway.status vs consumer.qr.orderStatus).
// Deliberately not shared/parameterised — small maintenance cost, zero risk
// of a takeaway-specific copy change regressing the QR status page.

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { getStatusLabel, POLL_PHASES, type OrderStatus as OrderStatusValue } from '@/lib/orders/statusLabels'

type Props = {
  token: string
  locale: 'nl' | 'en'
  initialStatus: OrderStatusValue
  initialOrderRef: string
}

const TERMINAL: OrderStatusValue[] = ['served', 'completed', 'cancelled', 'refunded']
const MAX_CONSECUTIVE_ERRORS = 5

const TONE_STYLES = {
  progress: { bg: '#fef3e2', text: '#8a4a08' },
  success: { bg: '#e9f4ea', text: '#1f5a2b' },
  ended: { bg: '#f2eee7', text: 'rgba(15, 13, 8, 0.8)' },
  error: { bg: '#fce9e9', text: '#8a1010' },
} as const

export function OrderStatus({ token, locale, initialStatus, initialOrderRef }: Props) {
  const t = useTranslations('consumer.takeaway.status')
  const [status, setStatus] = useState<OrderStatusValue>(initialStatus)
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date())
  const [minutesSinceUpdate, setMinutesSinceUpdate] = useState(0)

  const statusRef = useRef<OrderStatusValue>(initialStatus)
  const startedAtRef = useRef<number>(Date.now())
  const errorCountRef = useRef<number>(0)
  const stoppedRef = useRef<boolean>(TERMINAL.includes(initialStatus))

  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    if (stoppedRef.current) return

    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    async function poll() {
      if (cancelled || stoppedRef.current) return
      const elapsed = Date.now() - startedAtRef.current
      if (elapsed > POLL_PHASES.totalDurationMs) {
        stoppedRef.current = true
        return
      }

      try {
        const res = await fetch(`/api/v1/public/orders/${encodeURIComponent(token)}/status`, {
          cache: 'no-store',
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = (await res.json()) as
          | { ok: true; status: OrderStatusValue; orderRef: string; updatedAt: string }
          | { ok: false; error: string }
        if (!json.ok) throw new Error(json.error)
        errorCountRef.current = 0
        if (!cancelled) {
          if (json.status !== statusRef.current) {
            setStatus(json.status)
            setLastUpdated(new Date())
          }
          if (TERMINAL.includes(json.status)) {
            stoppedRef.current = true
            return
          }
        }
      } catch (err) {
        errorCountRef.current += 1
        console.warn('[OrderStatus] poll failed', err)
        if (errorCountRef.current >= MAX_CONSECUTIVE_ERRORS) {
          stoppedRef.current = true
          return
        }
      }

      if (cancelled || stoppedRef.current) return

      const nowElapsed = Date.now() - startedAtRef.current
      const nextInterval =
        nowElapsed < POLL_PHASES.fastPhaseDurationMs
          ? POLL_PHASES.fastIntervalMs
          : POLL_PHASES.slowIntervalMs
      timeoutId = setTimeout(poll, nextInterval)
    }

    // First poll after fastInterval — the initial state already arrived as props.
    timeoutId = setTimeout(poll, POLL_PHASES.fastIntervalMs)

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [token])

  // Human-readable "updated N minutes ago" text — refreshes every 30s.
  useEffect(() => {
    function tick() {
      const diffMs = Date.now() - lastUpdated.getTime()
      setMinutesSinceUpdate(Math.floor(diffMs / 60_000))
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [lastUpdated])

  const label = getStatusLabel(status, locale)
  const tone = TONE_STYLES[label.tone]
  const updatedText = t('minutesAgo', { count: minutesSinceUpdate })

  return (
    <section
      aria-live="polite"
      aria-atomic="true"
      style={{
        borderRadius: '20px',
        background: tone.bg,
        padding: '24px 24px 20px',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 700,
          fontSize: '11px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'rgba(15, 13, 8, 0.6)',
          margin: 0,
        }}
      >
        {t('codeLabel')}
      </p>
      <p
        style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 700,
          fontSize: '20px',
          color: 'var(--night, #0f0d08)',
          margin: '4px 0 0 0',
        }}
      >
        {initialOrderRef}
      </p>
      <h2
        style={{
          fontFamily: 'var(--font-raleway), serif',
          fontWeight: 900,
          fontSize: 'clamp(22px, 5vw, 26px)',
          lineHeight: 1.1,
          color: tone.text,
          margin: '24px 0 0 0',
        }}
      >
        {label.title}
      </h2>
      <p
        style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 400,
          fontSize: '15px',
          color: tone.text,
          margin: '8px 0 0 0',
        }}
      >
        {label.body}
      </p>
      <p
        style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 400,
          fontSize: '12px',
          color: 'rgba(15, 13, 8, 0.5)',
          margin: '16px 0 0 0',
        }}
      >
        {t('lastUpdated')} {updatedText}
      </p>
    </section>
  )
}
