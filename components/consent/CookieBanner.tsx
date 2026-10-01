'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { isEmbedBookingPath } from '@/components/consumer/HideInEmbed'
import {
  getHasConsentSnapshot,
  getServerHasConsentSnapshot,
  OPEN_COOKIE_SETTINGS_EVENT,
  readConsent,
  subscribeConsent,
  writeConsent,
} from '@/lib/consent'

function ToggleSwitch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean
  disabled?: boolean
  onChange?: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className="tafel-tap"
      style={{
        width: '44px',
        height: '26px',
        borderRadius: '100px',
        border: 'none',
        padding: '3px',
        backgroundColor: checked ? 'var(--tafel-primary-700)' : 'var(--cream)',
        boxShadow: checked ? 'none' : 'inset 0 0 0 1.5px var(--border)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'background-color 200ms ease',
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: checked ? 'flex-end' : 'flex-start',
      }}
    >
      <span
        style={{
          width: '20px',
          height: '20px',
          borderRadius: '50%',
          backgroundColor: checked ? 'var(--cream)' : 'var(--stone)',
          transition: 'transform 200ms ease',
        }}
      />
    </button>
  )
}

export default function CookieBanner() {
  const t = useTranslations('cookieBanner')
  const locale = useLocale()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isEmbed = isEmbedBookingPath(pathname, searchParams)

  // Whether any consent choice has been stored (and hasn't expired) — an
  // external-system value, synced via useSyncExternalStore rather than read
  // in a mount effect, so there's no server/client flash and no direct
  // setState-in-effect on load.
  const hasStoredConsent = useSyncExternalStore(
    subscribeConsent,
    getHasConsentSnapshot,
    getServerHasConsentSnapshot
  )

  const [reopened, setReopened] = useState(false)
  const [dismissedThisSession, setDismissedThisSession] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [analytics, setAnalytics] = useState(false)

  useEffect(() => {
    const handleReopen = () => {
      setAnalytics(readConsent()?.categories.analytics ?? false)
      setPanelOpen(true)
      setLeaving(false)
      setReopened(true)
    }
    window.addEventListener(OPEN_COOKIE_SETTINGS_EVENT, handleReopen)
    return () => window.removeEventListener(OPEN_COOKIE_SETTINGS_EVENT, handleReopen)
  }, [])

  const dismiss = useCallback(() => {
    setLeaving(true)
    setTimeout(() => {
      setDismissedThisSession(true)
      setReopened(false)
      setPanelOpen(false)
      setLeaving(false)
    }, 200)
  }, [])

  const acceptAll = () => {
    writeConsent({ analytics: true })
    dismiss()
  }
  const rejectAll = () => {
    writeConsent({ analytics: false })
    dismiss()
  }
  const savePreferences = () => {
    writeConsent({ analytics })
    dismiss()
  }

  const visible = !isEmbed && (reopened || (!hasStoredConsent && !dismissedThisSession))
  if (!visible && !leaving) return null

  const privacyHref = locale === 'en' ? '/en/privacybeleid' : '/privacybeleid'

  const buttonBase: React.CSSProperties = {
    fontFamily: 'var(--font-jost), sans-serif',
    fontSize: '11px',
    fontWeight: 700,
    letterSpacing: '0.12em',
    textTransform: 'uppercase',
    borderRadius: '100px',
    cursor: 'pointer',
    padding: '12px 24px',
    border: '1.5px solid var(--tafel-primary-700)',
    transition: 'transform 0.25s ease, box-shadow 0.25s ease',
  }

  const buttonPrimary: React.CSSProperties = {
    ...buttonBase,
    background: 'linear-gradient(135deg, var(--tafel-primary-700), var(--tafel-primary-900))',
    color: '#fff',
    border: 'none',
    boxShadow: '0 4px 16px rgba(var(--tafel-primary-900-rgb), 0.3)',
  }

  const buttonGhostAmber: React.CSSProperties = {
    ...buttonBase,
    backgroundColor: 'transparent',
    color: 'var(--tafel-primary-900)',
  }

  return (
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 500,
        display: 'flex',
        justifyContent: 'center',
        padding: '24px 16px',
        pointerEvents: 'none',
      }}
    >
      <div
        role="dialog"
        aria-label={t('headline')}
        style={{
          pointerEvents: 'auto',
          width: '100%',
          maxWidth: '640px',
          backgroundColor: 'var(--cream)',
          borderRadius: '20px',
          boxShadow: '0 12px 40px rgba(30,21,8,0.16), 0 0 0 1px rgba(156, 139, 106, 0.08)',
          padding: 'clamp(24px, 4vw, 32px)',
          transform: leaving ? 'translateY(24px)' : 'translateY(0)',
          opacity: leaving ? 0 : 1,
          transition: leaving
            ? 'transform 200ms ease-in, opacity 200ms ease-in'
            : 'transform 300ms ease-out, opacity 300ms ease-out',
          animation: leaving ? undefined : 'cookieBannerIn 300ms ease-out',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-raleway), sans-serif',
            fontWeight: 900,
            fontSize: '20px',
            letterSpacing: '-0.02em',
            color: 'var(--earth)',
            marginBottom: '12px',
          }}
        >
          {t('headline')}
        </h2>

        {!panelOpen ? (
          <>
            <p
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '14px',
                lineHeight: 1.6,
                color: 'var(--earth-mid)',
                marginBottom: '24px',
              }}
            >
              {t('description')}
            </p>
            <div
              className="cookie-banner-actions"
              style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}
            >
              <button
                type="button"
                onClick={rejectAll}
                className="tafel-tap cookie-banner-btn"
                style={buttonGhostAmber}
              >
                {t('rejectAll')}
              </button>
              <button
                type="button"
                onClick={() => setPanelOpen(true)}
                className="tafel-tap"
                style={{
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: 'var(--tafel-primary-900)',
                  textDecoration: 'underline',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '12px 8px',
                }}
              >
                {t('manage')}
              </button>
              <button
                type="button"
                onClick={acceptAll}
                className="tafel-tap cookie-banner-btn"
                style={buttonPrimary}
              >
                {t('acceptAll')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-jost), sans-serif', fontWeight: 600, fontSize: '14px', color: 'var(--earth)' }}>
                    {t('essentialName')}
                  </div>
                  <div style={{ fontFamily: 'var(--font-jost), sans-serif', fontSize: '13px', color: 'var(--stone)', marginTop: '2px' }}>
                    {t('essentialDescription')}
                  </div>
                </div>
                <ToggleSwitch checked disabled label={t('essentialName')} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-jost), sans-serif', fontWeight: 600, fontSize: '14px', color: 'var(--earth)' }}>
                    {t('analyticsName')}
                  </div>
                  <div style={{ fontFamily: 'var(--font-jost), sans-serif', fontSize: '13px', color: 'var(--stone)', marginTop: '2px' }}>
                    {t('analyticsDescription')}
                  </div>
                </div>
                <ToggleSwitch checked={analytics} onChange={() => setAnalytics((v) => !v)} label={t('analyticsName')} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-jost), sans-serif', fontWeight: 600, fontSize: '14px', color: 'var(--earth)' }}>
                    {t('marketingName')}
                  </div>
                  <div style={{ fontFamily: 'var(--font-jost), sans-serif', fontSize: '13px', color: 'var(--stone)', marginTop: '2px' }}>
                    {t('marketingDisabledNote')}
                  </div>
                </div>
                <ToggleSwitch checked={false} disabled label={t('marketingName')} />
              </div>
            </div>
            <div className="cookie-banner-actions" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={savePreferences}
                className="tafel-tap cookie-banner-btn"
                style={buttonPrimary}
              >
                {t('savePreferences')}
              </button>
              <button
                type="button"
                onClick={rejectAll}
                className="tafel-tap cookie-banner-btn"
                style={buttonGhostAmber}
              >
                {t('rejectAll')}
              </button>
            </div>
          </>
        )}

        <a
          href={privacyHref}
          style={{
            display: 'inline-block',
            marginTop: '16px',
            fontFamily: 'var(--font-jost), sans-serif',
            fontSize: '12px',
            color: 'var(--stone)',
            textDecoration: 'underline',
          }}
        >
          {t('privacyLink')}
        </a>
      </div>

      <style>{`
        @keyframes cookieBannerIn {
          from { transform: translateY(24px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @media (max-width: 480px) {
          .cookie-banner-btn { width: 100%; text-align: center; }
          .cookie-banner-actions { flex-direction: column; align-items: stretch; }
        }
      `}</style>
    </div>
  )
}
