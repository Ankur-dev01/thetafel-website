'use client'

import { useMemo, useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useParams } from 'next/navigation'

export default function SetPasswordPage() {
  const t = useTranslations('setPassword')
  const router = useRouter()
  const params = useParams()
  const locale = (params?.locale as string) || 'nl'
  const localePrefix = locale === 'en' ? '/en' : ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [touched, setTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  // Strength bar — 4 segments, filled by length thresholds
  // 1+ char → 1, 4+ → 2, 6+ → 3, 8+ → 4. 8+ = green, anything below = red.
  const strength = useMemo(() => {
    if (password.length === 0) return 0
    if (password.length < 4) return 1
    if (password.length < 6) return 2
    if (password.length < 8) return 3
    return 4
  }, [password])

  const isLongEnough = password.length >= 8
  const passwordsMatch = password === confirm
  const showMismatchError = touched && confirm.length > 0 && !passwordsMatch
  const canContinue = isLongEnough && passwordsMatch && confirm.length > 0

  const strengthColor = isLongEnough ? '#16a34a' : '#dc2626' // green : red
  const trackColor = 'rgba(156,139,106,0.2)'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    setServerError(null)

    if (!canContinue) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/set-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (res.ok) {
        router.push(`${localePrefix}/onboarding`)
        return
      }

      if (res.status === 401) {
        setServerError(t('errorUnauthorized'))
      } else if (res.status === 400) {
        setServerError(t('errorTooShort'))
      } else {
        setServerError(t('errorGeneral'))
      }
    } catch {
      setServerError(t('errorGeneral'))
    } finally {
      setSubmitting(false)
    }
  }

  // ───── styles ─────
  const labelStyle = {
    display: 'block',
    fontFamily: 'var(--font-jost), sans-serif',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    color: 'var(--stone)',
    marginBottom: '8px',
  }

  const inputStyle = {
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
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.2s ease',
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--cream)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div style={{ maxWidth: '480px', width: '100%' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div
            style={{
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: '9px',
              fontWeight: 700,
              letterSpacing: '0.32em',
              textTransform: 'uppercase',
              color: 'var(--amber)',
              marginBottom: '2px',
            }}
          >
            THE
          </div>
          <div
            style={{
              fontFamily: 'var(--font-raleway), sans-serif',
              fontSize: '28px',
              fontWeight: 900,
              color: 'var(--earth)',
              lineHeight: 1,
            }}
          >
            TAFEL
          </div>
        </div>

        {/* Card */}
        <div
          style={{
            backgroundColor: 'var(--warm)',
            borderRadius: '24px',
            padding: '48px 40px',
          }}
        >
          {/* Eyebrow */}
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

          {/* Heading */}
          <h1
            style={{
              fontFamily: 'var(--font-raleway), sans-serif',
              fontWeight: 900,
              fontSize: '32px',
              letterSpacing: '-0.02em',
              color: 'var(--earth)',
              marginBottom: '12px',
              lineHeight: 1.1,
            }}
          >
            {t('heading')}
          </h1>

          {/* Subtitle */}
          <p
            style={{
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: '14px',
              fontWeight: 300,
              lineHeight: 1.7,
              color: 'var(--stone)',
              marginBottom: '32px',
            }}
          >
            {t('sub')}
          </p>

          {/* Server error banner */}
          {serverError && (
            <div
              style={{
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '12px',
                padding: '12px 16px',
                marginBottom: '20px',
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '13px',
                color: '#dc2626',
              }}
            >
              {serverError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* Password input */}
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="password" style={labelStyle}>
                {t('labelPassword')}
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  setServerError(null)
                }}
                onBlur={() => setTouched(true)}
                placeholder={t('placeholderPassword')}
                autoComplete="new-password"
                style={inputStyle}
              />

              {/* Strength bar — 4 segments */}
              <div
                style={{
                  display: 'flex',
                  gap: '4px',
                  marginTop: '10px',
                  marginBottom: '6px',
                }}
              >
                {[0, 1, 2, 3].map((i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      height: '4px',
                      borderRadius: '2px',
                      backgroundColor:
                        i < strength ? strengthColor : trackColor,
                      transition: 'background-color 0.2s ease',
                    }}
                  />
                ))}
              </div>

              {/* Strength label */}
              <p
                style={{
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontSize: '12px',
                  fontWeight: 400,
                  color: isLongEnough ? '#16a34a' : 'var(--stone-light)',
                  margin: 0,
                }}
              >
                {isLongEnough ? t('strengthOk') : t('strengthMin')}
              </p>
            </div>

            {/* Confirm input */}
            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="confirm" style={labelStyle}>
                {t('labelConfirm')}
              </label>
              <input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => {
                  setConfirm(e.target.value)
                  setServerError(null)
                }}
                onBlur={() => setTouched(true)}
                placeholder={t('placeholderConfirm')}
                autoComplete="new-password"
                style={{
                  ...inputStyle,
                  borderColor: showMismatchError
                    ? '#fecaca'
                    : 'rgba(156,139,106,0.25)',
                }}
              />
              {showMismatchError && (
                <p
                  style={{
                    fontFamily: 'var(--font-jost), sans-serif',
                    fontSize: '12px',
                    fontWeight: 400,
                    color: '#dc2626',
                    marginTop: '8px',
                    marginBottom: 0,
                  }}
                >
                  {t('errorMismatch')}
                </p>
              )}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!canContinue || submitting}
              className="btn-primary"
              style={{
                width: '100%',
                opacity: !canContinue || submitting ? 0.5 : 1,
                cursor: !canContinue || submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? t('submitting') : t('submit')}
            </button>
          </form>
        </div>
      </div>
    </main>
  )
}