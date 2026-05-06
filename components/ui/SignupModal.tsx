'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations, useLocale } from 'next-intl'

interface SignupModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function SignupModal({ isOpen, onClose }: SignupModalProps) {
  const t = useTranslations('modal')
  const locale = useLocale()
  const router = useRouter()
  const [formData, setFormData] = useState({
    naam: '',
    email: '',
    telefoon: '',
    restaurant: '',
    stad: '',
  })
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [gdprAccepted, setGdprAccepted] = useState(false)

  if (!isOpen) return null

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.MouseEvent) => {
    e.preventDefault()
    setStatus('loading')
    setErrorMessage('')

    try {
      const response = await fetch('/api/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          bron: 'website-modal',
          locale,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.code === 'EMAIL_ALREADY_REGISTERED') {
          setErrorMessage(t('errorEmailExists'))
        } else if (data.code === 'RATE_LIMIT_EXCEEDED') {
          setErrorMessage(t('errorRateLimit'))
        } else {
          setErrorMessage(t('errorGeneral'))
        }
        setStatus('error')
        return
      }

      // Success: reset loading state, close the modal, then redirect.
      // Order matters — close before push so the modal unmounts cleanly while
      // the navigation is queued.
      const base = locale === 'en' ? '/en' : ''
      const redirectUrl = `${base}/verify-email?email=${encodeURIComponent(formData.email)}`
      setStatus('idle')
      onClose()
      router.push(redirectUrl)
    } catch {
      setErrorMessage(t('errorFallback'))
      setStatus('error')
    }
  }

  const overlayStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(30, 21, 8, 0.55)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '24px',
  }

  const modalStyle: React.CSSProperties = {
    backgroundColor: 'var(--cream)',
    borderRadius: '24px',
    maxWidth: '520px',
    width: '100%',
    maxHeight: '90vh',
    overflowY: 'auto',
    padding: '40px',
    position: 'relative',
    boxShadow: '0 24px 60px rgba(30, 21, 8, 0.25)',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '14px 16px',
    fontFamily: 'var(--font-jost), sans-serif',
    fontSize: '15px',
    fontWeight: 400,
    color: 'var(--earth)',
    backgroundColor: 'var(--warm)',
    border: '1px solid rgba(156,139,106,0.25)',
    borderRadius: '12px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s ease',
  }

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontFamily: 'var(--font-jost), sans-serif',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.15em',
    textTransform: 'uppercase',
    color: 'var(--stone)',
    marginBottom: '8px',
  }

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalStyle} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '32px',
            height: '32px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--stone)',
          }}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M5 5L15 15M15 5L5 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>

        <p
          style={{
            fontFamily: 'var(--font-jost), sans-serif',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--amber)',
            marginBottom: '12px',
          }}
        >
          {t('eyebrow')}
        </p>

        <h2
          style={{
            fontFamily: 'var(--font-raleway), sans-serif',
            fontWeight: 900,
            fontSize: '28px',
            letterSpacing: '-0.02em',
            color: 'var(--earth)',
            marginBottom: '12px',
            lineHeight: 1.1,
          }}
        >
          {t('heading')}
        </h2>

        <p
          style={{
            fontFamily: 'var(--font-jost), sans-serif',
            fontSize: '14px',
            fontWeight: 300,
            lineHeight: 1.7,
            color: 'var(--stone)',
            marginBottom: '24px',
          }}
        >
          {t('sub')}
        </p>

        {errorMessage && (
          <div
            style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '16px',
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: '13px',
              color: '#dc2626',
            }}
          >
            {errorMessage}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle}>{t('labelNaam')}</label>
            <input
              type="text"
              name="naam"
              value={formData.naam}
              onChange={handleChange}
              placeholder={t('placeholderNaam')}
              style={inputStyle}
              required
            />
          </div>
          <div>
            <label style={labelStyle}>{t('labelEmail')}</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder={t('placeholderEmail')}
              style={inputStyle}
              required
            />
          </div>
          <div>
            <label style={labelStyle}>{t('labelTelefoon')}</label>
            <input
              type="tel"
              name="telefoon"
              value={formData.telefoon}
              onChange={handleChange}
              placeholder={t('placeholderTelefoon')}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>{t('labelRestaurant')}</label>
            <input
              type="text"
              name="restaurant"
              value={formData.restaurant}
              onChange={handleChange}
              placeholder={t('placeholderRestaurant')}
              style={inputStyle}
              required
            />
          </div>
          <div>
            <label style={labelStyle}>{t('labelStad')}</label>
            <input
              type="text"
              name="stad"
              value={formData.stad}
              onChange={handleChange}
              placeholder={t('placeholderStad')}
              style={inputStyle}
              required
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <input
              type="checkbox"
              id="gdpr-consent"
              checked={gdprAccepted}
              onChange={(e) => setGdprAccepted(e.target.checked)}
              style={{
                marginTop: '2px',
                flexShrink: 0,
                accentColor: 'var(--amber)',
                width: '15px',
                height: '15px',
                cursor: 'pointer',
              }}
            />
            <label
              htmlFor="gdpr-consent"
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '12px',
                fontWeight: 400,
                color: 'var(--stone)',
                lineHeight: 1.5,
                cursor: 'pointer',
              }}
            >
              {locale === 'en' ? (
                <>
                  I agree to the{' '}
                  <a
                    href="/en/privacybeleid"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--amber)', textDecoration: 'underline' }}
                  >
                    privacy policy
                  </a>
                  {' '}and data processing by The Tafel.
                </>
              ) : (
                <>
                  Ik ga akkoord met de{' '}
                  <a
                    href="/privacybeleid"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--amber)', textDecoration: 'underline' }}
                  >
                    privacybeleid
                  </a>
                  {' '}en gegevensverwerking door The Tafel.
                </>
              )}
            </label>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={status === 'loading' || !gdprAccepted}
            className="btn-primary"
            style={{
              width: '100%',
              opacity: status === 'loading' || !gdprAccepted ? 0.5 : 1,
              cursor: status === 'loading' || !gdprAccepted ? 'not-allowed' : 'pointer',
              marginTop: '8px',
            }}
          >
            {status === 'loading' ? t('submitting') : t('submit')}
          </button>

          <p
            style={{
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: '12px',
              fontWeight: 400,
              color: 'var(--stone-light)',
              textAlign: 'center',
              marginTop: '4px',
            }}
          >
            {t('disclaimer')}
          </p>
        </div>
      </div>
    </div>
  )
}
