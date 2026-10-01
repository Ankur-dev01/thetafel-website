'use client'

import { useEffect, useRef, useState } from 'react'
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
  const firstFieldRef = useRef<HTMLInputElement | null>(null)
  const closeBtnRef = useRef<HTMLButtonElement | null>(null)

  // Body scroll lock + ESC-to-close + initial focus while open.
  useEffect(() => {
    if (!isOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    // Focus the first field for keyboard users, without stealing focus away
    // from anything that beat us to a click.
    const t = window.setTimeout(() => firstFieldRef.current?.focus(), 0)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
      window.clearTimeout(t)
    }
  }, [isOpen, onClose])

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
    backgroundColor: 'rgba(30, 21, 8, 0.62)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: '20px',
  }

  const modalStyle: React.CSSProperties = {
    backgroundColor: 'var(--cream)',
    borderRadius: '24px',
    maxWidth: '520px',
    width: '100%',
    maxHeight: 'calc(100dvh - 40px)',
    overflowY: 'auto',
    padding: 'clamp(28px, 5vw, 40px)',
    position: 'relative',
    boxShadow: '0 24px 60px rgba(30, 21, 8, 0.28), 0 0 0 1px rgba(156, 139, 106, 0.08)',
    WebkitOverflowScrolling: 'touch',
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '13px 16px',
    fontFamily: 'var(--font-jost), sans-serif',
    fontSize: '15px',
    fontWeight: 400,
    color: 'var(--earth)',
    backgroundColor: '#fff',
    border: '1.5px solid var(--cream-border)',
    borderRadius: '12px',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 180ms ease, box-shadow 180ms ease, background-color 180ms ease',
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
    <div
      style={overlayStyle}
      onClick={onClose}
      role="presentation"
      className="tafel-signup-overlay"
    >
      <div
        style={modalStyle}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tafel-signup-heading"
        className="tafel-signup-card"
      >
        <button
          ref={closeBtnRef}
          onClick={onClose}
          aria-label="Close"
          type="button"
          className="tafel-signup-close"
          style={{
            position: 'absolute',
            top: '16px',
            right: '16px',
            width: '36px',
            height: '36px',
            border: 'none',
            background: 'rgba(30, 21, 8, 0.04)',
            borderRadius: '999px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--stone)',
            transition: 'background-color 180ms ease, color 180ms ease',
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
          id="tafel-signup-heading"
          style={{
            fontFamily: 'var(--font-raleway), sans-serif',
            fontWeight: 900,
            fontSize: 'clamp(24px, 4vw, 28px)',
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
              backgroundColor: 'var(--burgundy-bg)',
              border: '1px solid rgba(161, 52, 52, 0.25)',
              borderRadius: '12px',
              padding: '12px 16px',
              marginBottom: '16px',
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: '13px',
              color: 'var(--burgundy)',
            }}
          >
            {errorMessage}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={labelStyle} htmlFor="tafel-signup-naam">{t('labelNaam')}</label>
            <input
              id="tafel-signup-naam"
              ref={firstFieldRef}
              type="text"
              name="naam"
              value={formData.naam}
              onChange={handleChange}
              placeholder={t('placeholderNaam')}
              className="tafel-signup-input"
              style={inputStyle}
              required
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="tafel-signup-email">{t('labelEmail')}</label>
            <input
              id="tafel-signup-email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder={t('placeholderEmail')}
              className="tafel-signup-input"
              style={inputStyle}
              required
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="tafel-signup-telefoon">{t('labelTelefoon')}</label>
            <input
              id="tafel-signup-telefoon"
              type="tel"
              name="telefoon"
              value={formData.telefoon}
              onChange={handleChange}
              placeholder={t('placeholderTelefoon')}
              className="tafel-signup-input"
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="tafel-signup-restaurant">{t('labelRestaurant')}</label>
            <input
              id="tafel-signup-restaurant"
              type="text"
              name="restaurant"
              value={formData.restaurant}
              onChange={handleChange}
              placeholder={t('placeholderRestaurant')}
              className="tafel-signup-input"
              style={inputStyle}
              required
            />
          </div>
          <div>
            <label style={labelStyle} htmlFor="tafel-signup-stad">{t('labelStad')}</label>
            <input
              id="tafel-signup-stad"
              type="text"
              name="stad"
              value={formData.stad}
              onChange={handleChange}
              placeholder={t('placeholderStad')}
              className="tafel-signup-input"
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

      <style>{`
        .tafel-signup-overlay {
          animation: tafelSignupOverlayIn 180ms ease-out;
          -webkit-backdrop-filter: blur(2px);
          backdrop-filter: blur(2px);
        }
        .tafel-signup-card {
          animation: tafelSignupCardIn 240ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes tafelSignupOverlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes tafelSignupCardIn {
          from { opacity: 0; transform: translateY(12px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .tafel-signup-input:focus {
          border-color: var(--amber) !important;
          box-shadow: 0 0 0 3px rgba(212, 130, 10, 0.18);
          background-color: #fff !important;
        }
        .tafel-signup-input::placeholder {
          color: var(--stone-light);
        }
        .tafel-signup-close:hover {
          background-color: rgba(30, 21, 8, 0.08) !important;
          color: var(--earth) !important;
        }
        .tafel-signup-close:focus-visible {
          outline: 2px solid var(--amber);
          outline-offset: 2px;
        }
        @media (max-width: 480px) {
          .tafel-signup-card {
            padding: 28px 22px !important;
            border-radius: 20px !important;
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .tafel-signup-overlay,
          .tafel-signup-card {
            animation: none !important;
          }
        }
      `}</style>
    </div>
  )
}
