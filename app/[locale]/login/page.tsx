'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useRouter, useParams, usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { TafelLogo } from '@/components/home/svgs'

export default function LoginPage() {
  const t = useTranslations('login')
  const router = useRouter()
  const params = useParams()
  const pathname = usePathname()
  const searchParams = useSearchParams()
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
        // Resolve where this user belongs (status-based) before pushing.
        try {
          const destRes = await fetch(
            `/api/auth/me/destination?locale=${locale}`,
            { cache: 'no-store' }
          )
          if (destRes.ok) {
            const data = (await destRes.json()) as { destination?: string }
            if (data?.destination && typeof data.destination === 'string') {
              router.push(data.destination)
              return
            }
          }
        } catch {
          // Fall through to the safe default below.
        }
        // Safe default if the destination lookup failed.
        router.push(`${localePrefix}/onboarding`)
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

  // Brand cream palette, aligned with homepage tokens.
  const labelStyle = {
    display: 'block',
    fontFamily: 'var(--font-jost), sans-serif',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.15em',
    textTransform: 'uppercase' as const,
    // Light on the orange-middle of the Commission-style gradient.
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
              color: 'rgba(30,21,8,0.75)',
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
                className="tafel-login-input"
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
                className="tafel-login-input"
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
                  color: '#ffffff',
                  textDecoration: 'underline',
                  textUnderlineOffset: '3px',
                }}
              >
                {t('forgotPassword')}
              </Link>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!canSubmit || submitting}
              className="btn-primary"
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, var(--tafel-primary-700), var(--tafel-primary-900))',
                boxShadow: '0 10px 24px rgba(var(--tafel-primary-900-rgb), 0.28)',
                color: '#fff',
                cursor: !canSubmit || submitting ? 'not-allowed' : 'pointer',
                opacity: !canSubmit || submitting ? 0.5 : 1,
              }}
            >
              {submitting ? t('submitting') : t('submit')}
            </button>
          </form>
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
