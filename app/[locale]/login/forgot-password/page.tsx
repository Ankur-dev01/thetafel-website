'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useParams, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const t = useTranslations('forgotPassword')
  const params = useParams()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const locale = (params?.locale as string) || 'nl'
  const localePrefix = locale === 'en' ? '/en' : ''

  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const canSubmit = email.trim().length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)
    if (!canSubmit) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      })

      // Per PRD: route returns 200 regardless of whether email exists
      // (prevents enumeration). Show success state in either case.
      if (res.ok) {
        setSent(true)
      } else if (res.status === 429) {
        setServerError(t('errorRateLimit'))
      } else {
        setServerError(t('errorGeneral'))
      }
    } catch {
      setServerError(t('errorGeneral'))
    } finally {
      setSubmitting(false)
    }
  }

  // Build language toggle target — strip current locale prefix, add the other,
  // and preserve query params
  const otherLocale = locale === 'en' ? 'nl' : 'en'
  const pathWithoutLocale =
    pathname.replace(/^\/(en|nl)(?=\/|$)/, '') || '/'
  const queryString = searchParams.toString()
  const querySuffix = queryString ? `?${queryString}` : ''
  const basePath =
    otherLocale === 'en'
      ? `/en${pathWithoutLocale === '/' ? '' : pathWithoutLocale}`
      : pathWithoutLocale
  const otherHref = `${basePath}${querySuffix}`

  // ───── styles (dark theme — matches /login) ─────
  const labelStyle = {
    display: 'block',
    fontFamily: 'var(--font-jost), sans-serif',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    color: '#888888',
    marginBottom: '8px',
  }

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    fontFamily: 'var(--font-jost), sans-serif',
    fontSize: '15px',
    fontWeight: 400,
    color: '#ededed',
    backgroundColor: '#111111',
    border: '1px solid #222222',
    borderRadius: '12px',
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 0.2s ease',
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: '#0a0a0a',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px',
      }}
    >
      {/* Top bar — language toggle */}
      <div
        style={{
          width: '100%',
          maxWidth: '480px',
          margin: '0 auto',
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingTop: '8px',
        }}
      >
        <Link
          href={otherHref}
          style={{
            fontFamily: 'var(--font-jost), sans-serif',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: '#888888',
            textDecoration: 'none',
          }}
        >
          {locale === 'en' ? 'NL' : 'EN'}
        </Link>
      </div>

      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ maxWidth: '420px', width: '100%' }}>
          {/* Logo */}
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <div
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '9px',
                fontWeight: 700,
                letterSpacing: '0.32em',
                textTransform: 'uppercase',
                color: '#d4820a',
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
                color: '#ededed',
                lineHeight: 1,
              }}
            >
              TAFEL
            </div>
          </div>

          {sent ? (
            <>
              {/* Success state */}
              <h1
                style={{
                  fontFamily: 'var(--font-raleway), sans-serif',
                  fontWeight: 900,
                  fontSize: '32px',
                  letterSpacing: '-0.02em',
                  color: '#ededed',
                  marginBottom: '12px',
                  lineHeight: 1.1,
                  textAlign: 'center',
                }}
              >
                {t('sentHeading')}
              </h1>
              <p
                style={{
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontSize: '14px',
                  fontWeight: 300,
                  lineHeight: 1.7,
                  color: '#888888',
                  marginBottom: '32px',
                  textAlign: 'center',
                }}
              >
                {t('sentSub')}
              </p>
              <div style={{ textAlign: 'center' }}>
                <Link
                  href={`${localePrefix}/login`}
                  style={{
                    fontFamily: 'var(--font-jost), sans-serif',
                    fontSize: '13px',
                    fontWeight: 500,
                    color: '#d4820a',
                    textDecoration: 'none',
                  }}
                >
                  {t('backToLogin')}
                </Link>
              </div>
            </>
          ) : (
            <>
              <h1
                style={{
                  fontFamily: 'var(--font-raleway), sans-serif',
                  fontWeight: 900,
                  fontSize: '32px',
                  letterSpacing: '-0.02em',
                  color: '#ededed',
                  marginBottom: '12px',
                  lineHeight: 1.1,
                  textAlign: 'center',
                }}
              >
                {t('heading')}
              </h1>

              <p
                style={{
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontSize: '14px',
                  fontWeight: 300,
                  lineHeight: 1.7,
                  color: '#888888',
                  marginBottom: '32px',
                  textAlign: 'center',
                }}
              >
                {t('sub')}
              </p>

              {serverError && (
                <div
                  style={{
                    backgroundColor: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.3)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    marginBottom: '20px',
                    fontFamily: 'var(--font-jost), sans-serif',
                    fontSize: '13px',
                    color: '#ef4444',
                  }}
                >
                  {serverError}
                </div>
              )}

              <form onSubmit={handleSubmit} noValidate>
                <div style={{ marginBottom: '24px' }}>
                  <label htmlFor="email" style={labelStyle}>
                    {t('labelEmail')}
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                      setServerError(null)
                    }}
                    placeholder={t('placeholderEmail')}
                    autoComplete="email"
                    style={inputStyle}
                  />
                </div>

                <button
                  type="submit"
                  disabled={!canSubmit || submitting}
                  style={{
                    width: '100%',
                    padding: '16px 24px',
                    fontFamily: 'var(--font-jost), sans-serif',
                    fontSize: '12px',
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: '#fdfaf5',
                    background:
                      'linear-gradient(135deg, #d4820a, #b86d08)',
                    border: 'none',
                    borderRadius: '100px',
                    cursor:
                      !canSubmit || submitting ? 'not-allowed' : 'pointer',
                    opacity: !canSubmit || submitting ? 0.5 : 1,
                    transition: 'opacity 0.2s ease',
                    marginBottom: '20px',
                  }}
                >
                  {submitting ? t('submitting') : t('submit')}
                </button>

                <div style={{ textAlign: 'center' }}>
                  <Link
                    href={`${localePrefix}/login`}
                    style={{
                      fontFamily: 'var(--font-jost), sans-serif',
                      fontSize: '13px',
                      fontWeight: 500,
                      color: '#888888',
                      textDecoration: 'none',
                    }}
                  >
                    {t('backToLogin')}
                  </Link>
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
