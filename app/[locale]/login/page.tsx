'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useParams, usePathname } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const t = useTranslations('login')
  const router = useRouter()
  const params = useParams()
  const pathname = usePathname()
  const locale = (params?.locale as string) || 'nl'
  const localePrefix = locale === 'en' ? '/en' : ''

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const canSubmit = email.trim().length > 0 && password.length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerError(null)
    if (!canSubmit) return

    setSubmitting(true)
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
      })

      if (res.ok) {
        router.push(`${localePrefix}/dashboard`)
        return
      }

      if (res.status === 429) {
        setServerError(t('errorRateLimit'))
      } else if (res.status === 401) {
        setServerError(t('errorInvalid'))
      } else {
        setServerError(t('errorGeneral'))
      }
    } catch {
      setServerError(t('errorGeneral'))
    } finally {
      setSubmitting(false)
    }
  }

  // Build language toggle target — strip current locale prefix and add the other
  const otherLocale = locale === 'en' ? 'nl' : 'en'
  const pathWithoutLocale =
    pathname.replace(/^\/(en|nl)(?=\/|$)/, '') || '/'
  const otherHref =
    otherLocale === 'en'
      ? `/en${pathWithoutLocale === '/' ? '' : pathWithoutLocale}`
      : pathWithoutLocale

  // ───── styles (dark theme — locked spec) ─────
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

          {/* Heading */}
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

          {/* Subtitle */}
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

          {/* Server error banner */}
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
            {/* Email */}
            <div style={{ marginBottom: '20px' }}>
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

            {/* Password */}
            <div style={{ marginBottom: '12px' }}>
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
                placeholder={t('placeholderPassword')}
                autoComplete="current-password"
                style={inputStyle}
              />
            </div>

            {/* Forgot password link */}
            <div style={{ marginBottom: '24px', textAlign: 'right' }}>
              <Link
                href={`${localePrefix}/login/forgot-password`}
                style={{
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontSize: '13px',
                  fontWeight: 500,
                  color: '#d4820a',
                  textDecoration: 'none',
                }}
              >
                {t('forgotPassword')}
              </Link>
            </div>

            {/* Submit */}
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
                background: 'linear-gradient(135deg, #d4820a, #b86d08)',
                border: 'none',
                borderRadius: '100px',
                cursor: !canSubmit || submitting ? 'not-allowed' : 'pointer',
                opacity: !canSubmit || submitting ? 0.5 : 1,
                transition: 'opacity 0.2s ease',
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
