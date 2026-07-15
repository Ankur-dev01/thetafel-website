'use client'

import { useCallback, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useTranslations } from 'next-intl'
import { TurnstileWidget } from '@/components/consumer/booking/TurnstileWidget'
import { useCart } from '@/lib/cart/CartContext'

type Props = {
  slug: string
  locale: 'nl' | 'en'
  pickupInstant: string
  restaurantName: string
}

type SubmitResponse =
  | {
      ok: true
      orderId: string
      orderRef: string
      checkoutUrl: string | null
      viewOrderUrl: string | null
      idempotentReplay: boolean
    }
  | {
      ok: false
      error: string
      rejections?: Array<{ menuItemId: string; reason: string }>
      minOrderCents?: number
    }

const TZ = 'Europe/Amsterdam'

function formatPickup(iso: string, locale: 'nl' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', {
    timeZone: TZ,
    weekday: 'long',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso))
}

function money(cents: number): string {
  return `€${(cents / 100).toFixed(2).replace('.', ',')}`
}

export function DetailsAndPay({ slug, locale, pickupInstant, restaurantName }: Props) {
  const t = useTranslations('consumer.takeaway.details')
  const errs = useTranslations('consumer.takeaway.details.errors')
  const { cart } = useCart()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const idempotencyKeyRef = useRef<string>(crypto.randomUUID())

  const totalCents = useMemo(
    () => cart.lines.reduce((sum, l) => sum + l.priceCents * l.quantity, 0),
    [cart.lines],
  )

  const disabled =
    submitting ||
    cart.lines.length === 0 ||
    !turnstileToken ||
    name.trim().length < 2 ||
    phone.trim().length < 6 ||
    !/^\S+@\S+\.\S+$/.test(email)

  const onSubmit = useCallback(async () => {
    if (disabled) return
    setError(null)
    setSubmitting(true)
    try {
      const lines = cart.lines.map((l) => ({
        menuItemId: l.itemId,
        quantity: l.quantity,
        itemNote: l.note || null,
      }))
      const res = await fetch(`/api/v1/public/${encodeURIComponent(slug)}/takeaway-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          locale,
          pickupInstant,
          lines,
          guestName: name.trim(),
          guestPhone: phone.trim(),
          guestEmail: email.trim(),
          guestNote: note.trim() || null,
          idempotencyKey: idempotencyKeyRef.current,
          turnstileToken,
        }),
      })
      const json = (await res.json()) as SubmitResponse
      if (!res.ok || !json.ok) {
        const code = (json as { error?: string }).error ?? 'unknown'
        switch (code) {
          case 'rate_limited':
            setError(errs('rateLimited'))
            break
          case 'turnstile_failed':
            setError(errs('turnstileFailed'))
            break
          case 'invalid_phone':
            setError(errs('invalidPhone'))
            break
          case 'items_invalid':
            setError(errs('itemsInvalid'))
            break
          case 'below_minimum':
            setError(errs('belowMinimum'))
            break
          case 'no_items':
            setError(errs('noItems'))
            break
          case 'pickup_out_of_window':
            setError(errs('pickupOutOfWindow'))
            break
          case 'takeaway_disabled':
          case 'not_accepting_orders':
            setError(errs('notAccepting'))
            break
          default:
            setError(code.startsWith('mollie_') ? errs('mollieError') : errs('generic'))
        }
        setSubmitting(false)
        return
      }
      if (json.checkoutUrl) {
        window.location.href = json.checkoutUrl
        return
      }
      if (json.viewOrderUrl) {
        window.location.href = json.viewOrderUrl
        return
      }
      setError(errs('generic'))
      setSubmitting(false)
    } catch (err) {
      console.error('[DetailsAndPay] submit failed', err)
      setError(errs('generic'))
      setSubmitting(false)
    }
  }, [disabled, slug, locale, pickupInstant, name, phone, email, note, turnstileToken, cart.lines, errs])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <section style={{ backgroundColor: '#fef3e2', borderRadius: '12px', padding: '16px' }}>
        <p style={pillStyle}>{t('pickupPill')}</p>
        <p style={pickupTimeStyle}>{formatPickup(pickupInstant, locale)}</p>
        <p style={restaurantNameStyle}>{restaurantName}</p>
      </section>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <label style={fieldLabelStyle}>
          <span>{t('nameLabel')}</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
            style={fieldInputStyle}
          />
        </label>
        <label style={fieldLabelStyle}>
          <span>{t('phoneLabel')}</span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            placeholder="+31 6 12345678"
            required
            style={fieldInputStyle}
          />
        </label>
        <label style={fieldLabelStyle}>
          <span>{t('emailLabel')}</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
            style={fieldInputStyle}
          />
        </label>
        <label style={fieldLabelStyle}>
          <span>{t('noteLabel')}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={200}
            rows={2}
            style={{ ...fieldInputStyle, resize: 'vertical' }}
          />
        </label>
      </div>

      <div style={totalRowStyle}>
        <span>{t('totalLabel')}</span>
        <span style={{ fontFamily: 'var(--font-jost), sans-serif', fontWeight: 600 }}>
          {money(totalCents)}
        </span>
      </div>

      <TurnstileWidget onSuccess={setTurnstileToken} onError={() => setTurnstileToken(null)} />

      {error ? (
        <div role="alert" style={errorBoxStyle}>
          {error}
        </div>
      ) : null}

      <button
        type="button"
        onClick={onSubmit}
        disabled={disabled}
        className="tafel-tap"
        style={{ ...submitButtonStyle, opacity: disabled ? 0.5 : 1 }}
      >
        {submitting ? t('submitting') : t('submitCta')}
      </button>
    </div>
  )
}

const pillStyle: CSSProperties = {
  fontFamily: 'var(--font-jost), sans-serif',
  fontWeight: 600,
  fontSize: '11px',
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: '#a86205',
  margin: 0,
}
const pickupTimeStyle: CSSProperties = {
  fontFamily: 'var(--font-raleway), serif',
  fontWeight: 900,
  fontSize: '22px',
  color: '#8a4a08',
  margin: '4px 0 0 0',
}
const restaurantNameStyle: CSSProperties = {
  fontFamily: 'var(--font-jost), sans-serif',
  fontWeight: 500,
  fontSize: '14px',
  color: '#8a4a08',
  margin: '4px 0 0 0',
  opacity: 0.85,
}
const fieldLabelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '6px',
  fontFamily: 'var(--font-jost), sans-serif',
  fontWeight: 500,
  fontSize: '13px',
  color: 'var(--night, #0f0d08)',
}
const fieldInputStyle: CSSProperties = {
  fontFamily: 'var(--font-jost), sans-serif',
  fontWeight: 400,
  fontSize: '15px',
  padding: '12px 14px',
  borderRadius: '10px',
  border: '1.5px solid rgba(15,13,8,0.12)',
  backgroundColor: '#fff',
  color: 'var(--night, #0f0d08)',
}
const totalRowStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  padding: '12px 0',
  fontFamily: 'var(--font-jost), sans-serif',
  fontSize: '15px',
  color: 'var(--night, #0f0d08)',
  borderTop: '1px solid rgba(15,13,8,0.08)',
}
const errorBoxStyle: CSSProperties = {
  fontFamily: 'var(--font-jost), sans-serif',
  fontWeight: 400,
  fontSize: '14px',
  color: '#8a1010',
  backgroundColor: '#fce9e9',
  padding: '10px 14px',
  borderRadius: '10px',
}
const submitButtonStyle: CSSProperties = {
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
