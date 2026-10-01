'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useParams, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { TafelLogo } from '@/components/home/svgs'

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

  // ───── styles (Commission-gradient background — matches /login) ─────
  const labelStyle = {
    display: 'block',
    fontFamily: 'var(--font-jost), sans-serif',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    // Light on the orange-middle of the gradient.
    color: 'rgba(255,255,255,0.9)',
    marginBottom: '8px',
  }

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    fontFamily: 'var(--font-jost), sans-serif',
    fontSize: '15px',
    fontWeight: 400,
    color: 'var(--earth)',
    backgroundColor: '#ffffff',
    border: '1.5px solid var(--cream-border)',
    borderRadius: '12px',
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'border-color 180ms ease, box-shadow 180ms ease',
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        // Mirrors the final homepage Commission background (components/home/home.module.css .commissionBg).
        background: 'linear-gradient(180deg, #ffffff 0%, var(--tafel-primary-900) 50%, #111111 100%)',
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
            color: 'var(--stone)',
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
          {/* Logo — matches the TafelLogo mark used by the final-UI Nav */}
          <Link
            href={locale === 'en' ? '/en' : '/'}
            aria-label="TAFEL"
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginBottom: '40px',
              color: 'var(--earth)',
              textDecoration: 'none',
            }}
          >
            <TafelLogo style={{ height: '26px', width: 'auto' }} />
            <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>TAFEL</span>
          </Link>

          {sent ? (
            <>
              {/* Success state */}
              <h1
                style={{
                  fontFamily: 'var(--font-raleway), sans-serif',
                  fontWeight: 900,
                  fontSize: '32px',
                  letterSpacing: '-0.02em',
                  color: 'var(--earth)',
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
                  color: 'rgba(30,21,8,0.75)',
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
                    color: 'rgba(30,21,8,0.75)',
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
                  color: 'var(--earth)',
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
                  color: 'rgba(30,21,8,0.75)',
                  marginBottom: '32px',
                  textAlign: 'center',
                }}
              >
                {t('sub')}
              </p>

              {serverError && (
                <div
                  style={{
                    backgroundColor: 'var(--burgundy-bg)',
                    border: '1px solid rgba(161, 52, 52, 0.25)',
                    borderRadius: '12px',
                    padding: '12px 16px',
                    marginBottom: '20px',
                    fontFamily: 'var(--font-jost), sans-serif',
                    fontSize: '13px',
                    color: 'var(--burgundy)',
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
                    className="tafel-login-input"
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
                    color: '#ffffff',
                    background:
                      'linear-gradient(135deg, var(--tafel-primary-700), var(--tafel-primary-900))',
                    boxShadow: '0 10px 24px rgba(var(--tafel-primary-900-rgb), 0.28)',
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
                      color: '#ffffff',
                      textDecoration: 'underline',
                      textUnderlineOffset: '3px',
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

      <style>{`
        .tafel-login-input:focus {
          border-color: var(--tafel-primary-700) !important;
          box-shadow: 0 0 0 3px rgba(var(--tafel-primary-900-rgb), 0.18);
        }
        .tafel-login-input::placeholder {
          color: var(--stone-light);
        }
      `}</style>
    </main>
  )
}
