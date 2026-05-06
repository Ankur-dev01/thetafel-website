'use client'

import { useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useSearchParams, usePathname } from 'next/navigation'
import Link from 'next/link'

export default function VerifyEmailPage() {
  const t = useTranslations('verifyEmail')
  const tToggle = useTranslations('languageToggle')
  const locale = useLocale()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const email = searchParams.get('email') || ''
  const error = searchParams.get('error') || ''
  const [resendStatus, setResendStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle')

  const handleResend = async () => {
    if (!email) return
    setResendStatus('loading')
    try {
      const response = await fetch('/api/auth/resend-magic-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, locale }),
      })
      if (response.ok) {
        setResendStatus('sent')
      } else {
        setResendStatus('error')
      }
    } catch {
      setResendStatus('error')
    }
  }

  const getErrorMessage = () => {
    if (error === 'expired') return t('errorExpired')
    if (error === 'used') return t('errorUsed')
    if (error === 'general') return t('errorGeneral')
    return ''
  }

  // Build language toggle target — strip current locale prefix and add the other
  const pathWithoutLocale = pathname.replace(/^\/(en|nl)(?=\/|$)/, '') || '/'
  const otherLocale = locale === 'en' ? 'nl' : 'en'
  const otherHref =
    otherLocale === 'en'
      ? `/en${pathWithoutLocale === '/' ? '' : pathWithoutLocale}`
      : pathWithoutLocale
  const toggleLabel = locale === 'en' ? tToggle('toDutch') : tToggle('toEnglish')

  return (
    <main
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--cream)',
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
          {toggleLabel}
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
        <div
          style={{
            maxWidth: '480px',
            width: '100%',
            textAlign: 'center',
          }}
        >
          {/* Logo */}
          <div style={{ marginBottom: '40px' }}>
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
            {/* Email icon */}
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'var(--amber-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 28 28"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M4 7C4 5.9 4.9 5 6 5H22C23.1 5 24 5.9 24 7V21C24 22.1 23.1 23 22 23H6C4.9 23 4 22.1 4 21V7Z"
                  stroke="#d4820a"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M4 7L14 15L24 7"
                  stroke="#d4820a"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>

            {/* Error message if present */}
            {error && (
              <div
                style={{
                  backgroundColor: '#fef2f2',
                  border: '1px solid #fecaca',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  marginBottom: '24px',
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontSize: '14px',
                  color: '#dc2626',
                }}
              >
                {getErrorMessage()}
              </div>
            )}

            {/* Heading */}
            <h1
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
            </h1>

            {/* Email address */}
            {email && (
              <p
                style={{
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontSize: '15px',
                  fontWeight: 400,
                  color: 'var(--stone)',
                  marginBottom: '8px',
                }}
              >
                {t('sub')}{' '}
                <strong style={{ color: 'var(--earth)', fontWeight: 600 }}>
                  {decodeURIComponent(email)}
                </strong>
              </p>
            )}

            {/* Instructions */}
            <p
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '14px',
                fontWeight: 300,
                lineHeight: 1.75,
                color: 'var(--stone)',
                marginBottom: '8px',
              }}
            >
              {t('instructions')}
            </p>

            {/* Spam note */}
            <p
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '13px',
                fontWeight: 400,
                color: 'var(--stone-light)',
                marginBottom: '32px',
              }}
            >
              {t('spam')}
            </p>

            {/* Divider */}
            <div
              style={{
                height: '1px',
                backgroundColor: 'rgba(156,139,106,0.2)',
                marginBottom: '24px',
              }}
            />

            {/* Resend button */}
            <button
              onClick={handleResend}
              disabled={resendStatus === 'loading' || resendStatus === 'sent'}
              className="btn-primary"
              style={{
                width: '100%',
                opacity: resendStatus === 'sent' ? 0.7 : 1,
                cursor: resendStatus === 'loading' || resendStatus === 'sent' ? 'not-allowed' : 'pointer',
              }}
            >
              {resendStatus === 'loading'
                ? t('resending')
                : resendStatus === 'sent'
                ? t('resent')
                : t('resend')}
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
