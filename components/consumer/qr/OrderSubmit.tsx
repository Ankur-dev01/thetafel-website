'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { useCart } from '@/lib/cart/CartContext'
import { TurnstileWidget } from '@/components/consumer/booking/TurnstileWidget'

type Locale = 'nl' | 'en'

type OrderSubmitProps = {
  locale: Locale
  slug: string
  tableId: string
  payMode: 'pay_now' | 'pay_at_table'
  accentHex: string
  paymentMethod?: 'ideal' | 'card'
  t: {
    submitting: string
    submit: string
    genericError: string
    itemsInvalidBody: string
    rateLimited: string
    turnstileFailed: string
    noItems: string
    tabBusy: string
    payModeDisabled: string
    tableNotFound: string
    mollieError: string
  }
}

type SubmitResponse =
  | {
      ok: true
      orderId: string
      orderRef: string
      payMode: 'pay_now' | 'pay_at_table'
      checkoutUrl: string | null
      viewOrderUrl: string | null
      idempotentReplay: boolean
    }
  | {
      ok: false
      error: string
      rejections?: Array<{ menuItemId: string; reason: string }>
    }

export function OrderSubmit({
  locale,
  slug,
  tableId,
  payMode,
  accentHex,
  paymentMethod,
  t,
}: OrderSubmitProps) {
  const { cart, clearCart } = useCart()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

  // One idempotency key per mounted component instance — survives double-taps.
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID())

  const lines = useMemo(
    () =>
      cart.lines.map((line) => ({
        menuItemId: line.itemId,
        quantity: line.quantity,
        itemNote: line.note || null,
      })),
    [cart.lines],
  )

  const disabled = submitting || lines.length === 0 || !turnstileToken

  const onSubmit = useCallback(async () => {
    if (disabled) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/v1/public/${encodeURIComponent(slug)}/order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          tableId,
          payMode,
          locale,
          lines,
          guestNote: null,
          paymentMethod,
          idempotencyKey: idempotencyKeyRef.current,
          turnstileToken,
        }),
      })
      const json = (await res.json()) as SubmitResponse

      if (!res.ok || !json.ok) {
        const code = (json as { error?: string }).error ?? 'unknown'
        switch (code) {
          case 'rate_limited':
            setError(t.rateLimited)
            break
          case 'turnstile_failed':
            setError(t.turnstileFailed)
            break
          case 'no_items':
            setError(t.noItems)
            break
          case 'items_invalid':
            setError(t.itemsInvalidBody)
            break
          case 'tab_busy':
            setError(t.tabBusy)
            break
          case 'pay_mode_disabled':
            setError(t.payModeDisabled)
            break
          case 'table_not_found':
          case 'restaurant_not_found':
            setError(t.tableNotFound)
            break
          default:
            setError(code.startsWith('mollie_') ? t.mollieError : t.genericError)
        }
        setSubmitting(false)
        return
      }

      if (json.payMode === 'pay_now' && json.checkoutUrl) {
        // Cart is cleared once the webhook confirms payment, not here — a
        // failed Mollie hop should not lose the cart.
        window.location.href = json.checkoutUrl
        return
      }
      if (json.payMode === 'pay_at_table' && json.viewOrderUrl) {
        clearCart()
        window.location.href = json.viewOrderUrl
        return
      }
      setError(t.genericError)
      setSubmitting(false)
    } catch (err) {
      console.error('[OrderSubmit] request failed', err)
      setError(t.genericError)
      setSubmitting(false)
    }
  }, [disabled, slug, tableId, payMode, locale, lines, paymentMethod, turnstileToken, clearCart, t])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <TurnstileWidget onSuccess={(token) => setTurnstileToken(token)} />

      {error ? (
        <div
          role="alert"
          style={{
            borderRadius: '12px',
            background: '#fef3e2',
            padding: '12px 16px',
            fontFamily: 'var(--font-jost), sans-serif',
            fontSize: '14px',
            color: '#8a4a08',
          }}
        >
          {error}
        </div>
      ) : null}

      <button
        type="button"
        className="tafel-tap"
        onClick={onSubmit}
        disabled={disabled}
        style={{
          width: '100%',
          background: accentHex,
          color: '#fff',
          padding: '14px 20px',
          borderRadius: '999px',
          border: 'none',
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 600,
          fontSize: '15px',
          opacity: disabled ? 0.6 : 1,
        }}
      >
        {submitting ? t.submitting : t.submit}
      </button>
    </div>
  )
}
