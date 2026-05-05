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
        body: JSON.stringify({ ...formData, bron: 'website-modal' }),
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

      const base = locale === 'en' ? '/en' : ''
      onClose()
      router.push(`${base}/verify-email?email=${encodeURIComponent(formData.email)}`)
    } catch {
      setErrorMessage(t('errorFallback'))
      setStatus('error')
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    fontFamily: 'var(--font-jost), sans-serif',
    fontSize: '14px',
    fontWeight: 400,
    color: 'var(--earth)',
    backgroundColor: 'var(--warm)',
    border: '1px solid rgba(156,139,106,0.25)',
    borderRadius: '12px',
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.2s ease',
  }

  const labelStyle = {
    display: 'block',
    fontFamily: 'var(--font-jost), sans-serif',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    color: 'var(--stone)',
    marginBottom: '6px',
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        backgroundColor: 'rgba(15,13,8,0.8)',
        backdropFilter: 'blur(8px)',
        animation: 'modalFadeIn 0.25s ease',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="modal-inner modal-inner-content"
        style={{
          backgroundColor: 'var(--cream)',
          borderRadius: '24px',
          padding: '48px',
          width: '100%',
          maxWidth: '480px',
          position: 'relative',
          animation: 'modalSlideUp 0.3s cubic-bezier(0.16,1,0.3,1)',
          maxHeight: '90vh',
          overflowY: 'auto',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            backgroundColor: 'var(--warm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--stone)',
            fontFamily: 'var(--font-jost), sans-serif',
            fontSize: '16px',
          }}
          aria-label="Close"
        >
          x
        </button>

        <div style={{ marginBottom: '32px' }}>
          <div
            style={{
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: 'var(--amber)',
              marginBottom: '8px',
            }}
          >
            {t('eyebrow')}
          </div>
          <h2
            style={{
              fontFamily: 'var(--font-raleway), sans-serif',
              fontWeight: 900,
              fontSize: '32px',
              letterSpacing: '-0.025em',
              lineHeight: 1.05,
              color: 'var(--earth)',
              marginBottom: '8px',
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
            }}
          >
            {t('sub')}
          </p>
        </div>

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

          {status === 'error' && (
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '8px',
                padding: '12px 16px',
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '13px',
                color: '#dc2626',
              }}
            >
              {errorMessage}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!gdprAccepted || status === 'loading'}
            className="btn-primary"
            style={{
              width: '100%',
              marginTop: '8px',
              opacity: !gdprAccepted || status === 'loading' ? 0.5 : 1,
              cursor: !gdprAccepted || status === 'loading' ? 'not-allowed' : 'pointer',
            }}
          >
            {status === 'loading' ? t('submitting') : t('submit')}
          </button>

          <p
            style={{
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: '11px',
              fontWeight: 400,
              color: 'var(--stone-light)',
              textAlign: 'center',
              lineHeight: 1.5,
            }}
          >
            {t('disclaimer')}
          </p>
        </div>
      </div>

      <style>{`
        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes modalSlideUp {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .modal-inner::-webkit-scrollbar {
          display: none;
        }
        @media (max-width: 480px) {
          .modal-inner-content { padding: 32px 24px !important; }
        }
      `}</style>
    </div>
  )
}
