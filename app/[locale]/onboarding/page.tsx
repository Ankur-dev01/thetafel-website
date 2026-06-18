'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import { useRouter, useParams, usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import StepFrame from '@/components/onboarding/shell/StepFrame'
import SavedIndicator from '@/components/onboarding/shell/SavedIndicator'
import { useDraftSave } from '@/lib/onboarding/useDraftSave'
import { stepPath } from '@/lib/onboarding/routes'
import { getVisibleSteps, getTotalWizardSteps } from '@/lib/onboarding/steps'
import type { Locale } from '@/lib/onboarding/routes'

type ServiceFlags = {
  service_reservations_enabled: boolean
  service_takeaway_enabled: boolean
  service_qr_enabled: boolean
}

const SERVICE_KEYS = [
  'service_reservations_enabled',
  'service_takeaway_enabled',
  'service_qr_enabled',
] as const

// ── Sub-components ─────────────────────────────────────────────────────────────

function CheckCircle({ selected }: { selected: boolean }) {
  return (
    <div style={{
      width: 30,
      height: 30,
      borderRadius: '9999px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: selected ? 'var(--amber)' : 'transparent',
      border: selected ? 'none' : '2px solid var(--cream-border)',
      transition: 'background 180ms ease, border-color 180ms ease',
      flexShrink: 0,
    }}>
      {selected && (
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#fffefb"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ animation: 'check-pop 250ms ease forwards' }}
        >
          <polyline points="5 13 9 17 19 7" />
        </svg>
      )}
    </div>
  )
}

type ServiceCardProps = {
  title: string
  description: string
  selected: boolean
  onClick: () => void
  icon: React.ReactNode
  iconBg: string
  iconColor: string
  cornerGlow: string
  chips: string[]
  chipColor: string
  chipBg: string
  chipBorder: string
}

function ServiceCard({
  title, description, selected, onClick,
  icon, iconBg, iconColor, cornerGlow,
  chips, chipColor, chipBg, chipBorder,
}: ServiceCardProps) {
  const [hovered, setHovered] = useState(false)

  const shadow = selected
    ? '0 1px 2px rgba(30, 21, 8, 0.04), 0 20px 44px rgba(212, 130, 10, 0.14)'
    : hovered
      ? '0 4px 8px rgba(30, 21, 8, 0.05), 0 22px 52px rgba(212, 130, 10, 0.16)'
      : '0 1px 2px rgba(30, 21, 8, 0.04), 0 16px 38px rgba(212, 130, 10, 0.10)'

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '22px',
        padding: '26px 26px 24px',
        backgroundColor: 'var(--cream-card)',
        cursor: 'pointer',
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
        boxShadow: shadow,
        transition: 'transform 160ms ease, box-shadow 200ms ease, background 200ms ease',
      }}
    >
      {/* Corner glow */}
      <span style={{
        position: 'absolute',
        top: -40,
        right: -40,
        width: 130,
        height: 130,
        borderRadius: '9999px',
        background: cornerGlow,
        pointerEvents: 'none',
      }} />

      {/* Top row: icon tile + check circle */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '22px',
        position: 'relative',
      }}>
        <div style={{
          width: 50,
          height: 50,
          borderRadius: '14px',
          backgroundColor: iconBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: iconColor,
        }}>
          {icon}
        </div>
        <CheckCircle selected={selected} />
      </div>

      {/* Title */}
      <div style={{
        fontFamily: 'var(--font-raleway), Raleway, sans-serif',
        fontWeight: 900,
        fontSize: '32px',
        letterSpacing: '-0.02em',
        lineHeight: 1,
        color: 'var(--earth)',
        margin: '0 0 9px 0',
        position: 'relative',
      }}>
        {title}
      </div>

      {/* Description */}
      <p style={{
        fontFamily: 'var(--font-jost), Jost, sans-serif',
        fontWeight: 400,
        fontSize: '14.5px',
        lineHeight: 1.5,
        color: 'var(--stone)',
        margin: '0 0 18px 0',
        maxWidth: '340px',
        position: 'relative',
      }}>
        {description}
      </p>

      {/* Feature chips */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '7px',
        position: 'relative',
      }}>
        {chips.map((chip) => (
          <span
            key={chip}
            style={{
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontWeight: 600,
              fontSize: '12.5px',
              padding: '5px 11px',
              borderRadius: '9999px',
              color: chipColor,
              backgroundColor: chipBg,
              border: `1px solid ${chipBorder}`,
            }}
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  )
}

function DeliveryCard({
  title, description, chips, comingSoonLabel, icon,
}: {
  title: string
  description: string
  chips: string[]
  comingSoonLabel: string
  icon: React.ReactNode
}) {
  return (
    <div style={{
      position: 'relative',
      overflow: 'hidden',
      borderRadius: '22px',
      padding: '26px 26px 24px',
      backgroundColor: '#f5f0e3',
      cursor: 'not-allowed',
      opacity: 0.74,
    }}>
      {/* Top row: icon tile + coming soon pill */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '22px',
        position: 'relative',
      }}>
        <div style={{
          width: 50,
          height: 50,
          borderRadius: '14px',
          backgroundColor: '#ede5d5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: '#b8a585',
        }}>
          {icon}
        </div>
        <span style={{
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontWeight: 800,
          fontSize: '11px',
          letterSpacing: '0.07em',
          textTransform: 'uppercase',
          color: 'var(--cream-card)',
          backgroundColor: '#c2a878',
          padding: '5px 13px',
          borderRadius: '9999px',
        }}>
          {comingSoonLabel}
        </span>
      </div>

      {/* Title */}
      <div style={{
        fontFamily: 'var(--font-raleway), Raleway, sans-serif',
        fontWeight: 900,
        fontSize: '32px',
        letterSpacing: '-0.02em',
        lineHeight: 1,
        color: '#6f6353',
        margin: '0 0 9px 0',
      }}>
        {title}
      </div>

      {/* Description */}
      <p style={{
        fontFamily: 'var(--font-jost), Jost, sans-serif',
        fontWeight: 400,
        fontSize: '14.5px',
        lineHeight: 1.5,
        color: '#9c8b6a',
        margin: '0 0 18px 0',
        maxWidth: '340px',
      }}>
        {description}
      </p>

      {/* Feature chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px' }}>
        {chips.map((chip) => (
          <span
            key={chip}
            style={{
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontWeight: 600,
              fontSize: '12.5px',
              padding: '5px 11px',
              borderRadius: '9999px',
              color: 'var(--stone-dim)',
              backgroundColor: '#eee6d3',
            }}
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ServicePickerPage() {
  const t = useTranslations('onboarding.services')
  const router = useRouter()
  const params = useParams()
  const locale = ((params?.locale as string) || 'nl') as Locale
  const pathname = usePathname()

  const [flags, setFlags] = useState<ServiceFlags>({
    service_reservations_enabled: false,
    service_takeaway_enabled: false,
    service_qr_enabled: false,
  })
  const [totalSteps, setTotalSteps] = useState(13)
  const [hydrating, setHydrating] = useState(true)
  const [pageError, setPageError] = useState<string | null>(null)
  const [advancing, setAdvancing] = useState(false)
  const [hovBundle, setHovBundle] = useState(false)

  const { saveNow, state: saveState } = useDraftSave()
  const [, startTransition] = useTransition()

  // ─── Hydrate from existing draft ──────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    async function hydrate() {
      try {
        const res = await fetch('/api/v1/restaurants/draft', {
          method: 'GET',
          cache: 'no-store',
        })
        if (!res.ok) {
          if (!cancelled) setHydrating(false)
          return
        }
        const data = await res.json()
        const r =
          data?.restaurant ??
          data?.data?.restaurant ??
          data?.draft?.restaurant ??
          data
        if (!cancelled && r) {
          if (r.status && r.status !== 'onboarding') {
            const prefix = locale === 'en' ? '/en' : ''
            if (r.status === 'pending_review') {
              router.replace(`${prefix}/onboarding/submitted`)
            } else if (r.status === 'live') {
              router.replace(`${prefix}/onboarding/live`)
            } else {
              router.replace(locale === 'en' ? '/en/login' : '/login')
            }
            return
          }
          setFlags({
            service_reservations_enabled: Boolean(r.service_reservations_enabled),
            service_takeaway_enabled: Boolean(r.service_takeaway_enabled),
            service_qr_enabled: Boolean(r.service_qr_enabled),
          })
          try {
            const visible = getVisibleSteps(r)
            setTotalSteps(getTotalWizardSteps(visible))
          } catch {
            // leave default 13
          }
        }
      } catch {
        // silent
      } finally {
        if (!cancelled) setHydrating(false)
      }
    }
    hydrate()
    return () => {
      cancelled = true
    }
  }, [pathname])

  // ─── Card toggle handler ──────────────────────────────────────────────────
  const handleToggle = useCallback(
    async (key: (typeof SERVICE_KEYS)[number]) => {
      const previous = flags[key]
      const next = !previous
      setFlags((prev) => ({ ...prev, [key]: next }))
      setPageError(null)
      try {
        await saveNow({ restaurant: { [key]: next } })
        startTransition(() => {
          router.refresh()
        })
      } catch {
        setFlags((prev) => ({ ...prev, [key]: previous }))
        setPageError(t('errorSave'))
      }
    },
    [flags, saveNow, t, router, startTransition]
  )

  // ─── Bundle bar select-all handler ────────────────────────────────────────
  const allSelected =
    flags.service_reservations_enabled &&
    flags.service_takeaway_enabled &&
    flags.service_qr_enabled

  const handleSelectAll = useCallback(async () => {
    const nextValue = !allSelected
    const nextFlags = {
      service_reservations_enabled: nextValue,
      service_takeaway_enabled: nextValue,
      service_qr_enabled: nextValue,
    }
    setFlags(nextFlags)
    setPageError(null)
    try {
      await saveNow({ restaurant: nextFlags })
      startTransition(() => {
        router.refresh()
      })
    } catch {
      setFlags({
        service_reservations_enabled: !nextValue,
        service_takeaway_enabled: !nextValue,
        service_qr_enabled: !nextValue,
      })
      setPageError(t('errorSave'))
    }
  }, [allSelected, saveNow, t, router, startTransition])

  // ─── Continue handler ─────────────────────────────────────────────────────
  const atLeastOneSelected =
    flags.service_reservations_enabled ||
    flags.service_takeaway_enabled ||
    flags.service_qr_enabled

  const handleContinue = useCallback(async () => {
    if (!atLeastOneSelected || advancing) return
    setAdvancing(true)
    setPageError(null)
    try {
      await saveNow({ restaurant: { current_onboarding_step: 1 } })
      const nextPath = stepPath(1, locale)
      router.refresh()
      if (nextPath) router.push(nextPath)
    } catch {
      setPageError(t('errorAdvance'))
      setAdvancing(false)
    }
  }, [atLeastOneSelected, advancing, saveNow, router, locale, t])

  // ─── Feature chip arrays ──────────────────────────────────────────────────
  const resvChips = [
    t('cards.reservations.features.onlineBooking'),
    t('cards.reservations.features.floorPlan'),
    t('cards.reservations.features.noShow'),
  ]
  const takeChips = [
    t('cards.takeaway.features.onlineOrders'),
    t('cards.takeaway.features.payment'),
    t('cards.takeaway.features.instantPayment'),
  ]
  const qrChips = [
    t('cards.qr.features.tableQr'),
    t('cards.qr.features.mobileMenu'),
    t('cards.qr.features.directOrdering'),
  ]
  const deliveryChips = [
    t('cards.delivery.features.courierPartners'),
    t('cards.delivery.features.ownDelivery'),
  ]

  // ─── Heading split (last char = amber "?") ────────────────────────────────
  const heading = t('heading')
  const headingBody = heading.slice(0, -1)
  const headingMark = heading.slice(-1)

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <StepFrame
      locale={locale}
      showProgress={false}
      hideDefaultHeader
      currentStepDisplayNumber={1}
      totalSteps={totalSteps}
      heading=""
      backHref={null}
      canContinue={atLeastOneSelected && !hydrating}
      isSubmitting={advancing}
      continueLabel={t('continueLabel')}
      submittingLabel={t('continueSubmitting')}
      onContinue={handleContinue}
      error={pageError}
      onDismissError={() => setPageError(null)}
      savedIndicator={<SavedIndicator state={saveState} locale={locale} />}
    >
      <style>{`
        @keyframes check-pop {
          0%   { transform: scale(0.4); opacity: 0; }
          70%  { transform: scale(1.15); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
        .svc-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 18px;
        }
        @media (max-width: 600px) {
          .svc-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      {/* ── Header band ────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: '34px',
        gap: '16px',
      }}>
        {/* Left: step pill + title + description */}
        <div>
          {/* Step pill */}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            backgroundColor: 'var(--earth)',
            color: 'var(--amber)',
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontWeight: 700,
            fontSize: '9.5px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            padding: '6px 12px',
            borderRadius: '9999px',
            marginBottom: '14px',
          }}>
            <span style={{
              width: 6,
              height: 6,
              borderRadius: '9999px',
              backgroundColor: 'var(--amber)',
              flexShrink: 0,
              display: 'inline-block',
            }} />
            {locale === 'en'
              ? `Step 1 of ${totalSteps} — Services`
              : `Stap 1 van ${totalSteps} — Diensten`}
          </div>

          {/* Title */}
          <h1 style={{
            fontFamily: 'var(--font-raleway), Raleway, sans-serif',
            fontWeight: 900,
            fontSize: '42px',
            lineHeight: 0.96,
            letterSpacing: '-0.035em',
            color: 'var(--earth)',
            margin: '0 0 10px 0',
          }}>
            {headingBody}
            <span style={{ color: 'var(--amber)' }}>{headingMark}</span>
          </h1>

          {/* Description */}
          <p style={{
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontWeight: 400,
            fontSize: '16px',
            lineHeight: 1.5,
            color: 'var(--stone)',
            maxWidth: '520px',
            margin: 0,
          }}>
            {t('sub')}
          </p>
        </div>

        {/* Right: step counter + progress segments */}
        <div style={{ flexShrink: 0, textAlign: 'right' }}>
          <div style={{
            fontFamily: 'var(--font-raleway), Raleway, sans-serif',
            fontWeight: 900,
            fontSize: '32px',
            letterSpacing: '-0.02em',
            lineHeight: 1,
            color: 'var(--earth)',
          }}>
            01
            <span style={{ fontSize: '17px', color: 'var(--stone-dim)', letterSpacing: '-0.01em' }}>
              /{String(totalSteps).padStart(2, '0')}
            </span>
          </div>
          <div style={{
            display: 'flex',
            gap: '3px',
            justifyContent: 'flex-end',
            marginTop: '10px',
          }}>
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 2,
                  backgroundColor: i === 0 ? 'var(--sage)' : 'var(--cream-border)',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ── Recommended bundle bar ──────────────────────────────────────────── */}
      <div
        role="button"
        tabIndex={0}
        onClick={handleSelectAll}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleSelectAll() }}
        onMouseEnter={() => setHovBundle(true)}
        onMouseLeave={() => setHovBundle(false)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          backgroundColor: allSelected ? 'var(--sage-bg)' : 'var(--cream-card)',
          border: allSelected
            ? '1.5px solid var(--sage)'
            : '1.5px solid var(--cream-border)',
          borderRadius: '18px',
          padding: '16px 20px',
          marginBottom: '18px',
          cursor: 'pointer',
          filter: hovBundle ? 'brightness(1.02)' : 'none',
          transition: 'background 200ms ease, border-color 200ms ease, filter 150ms ease',
        }}
      >
        {/* Star tile */}
        <div style={{
          width: 42,
          height: 42,
          borderRadius: '12px',
          backgroundColor: 'var(--amber)',
          boxShadow: '0 4px 12px rgba(212, 130, 10, 0.32)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="#fdfaf5" aria-hidden="true">
            <path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.6l1-5.8L3.5 9.7l5.9-.9z" />
          </svg>
        </div>

        {/* Text block */}
        <div style={{ flex: 1 }}>
          <div style={{
            fontFamily: 'var(--font-raleway), Raleway, sans-serif',
            fontWeight: 900,
            fontSize: '19px',
            lineHeight: 1.15,
            color: 'var(--earth)',
          }}>
            {t('hintBannerTitle')}
          </div>
          <div style={{
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontWeight: 400,
            fontSize: '14px',
            lineHeight: 1.4,
            color: 'var(--stone)',
            marginTop: '2px',
          }}>
            {t('hintBannerSub')}
          </div>
        </div>

        {/* Status chip */}
        {allSelected ? (
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontWeight: 800,
            fontSize: '13px',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'var(--sage)',
            backgroundColor: 'var(--sage-bg)',
            border: '1.5px solid var(--sage)',
            padding: '9px 16px',
            borderRadius: '9999px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ animation: 'check-pop 250ms ease forwards' }}
            >
              <polyline points="5 13 9 17 19 7" />
            </svg>
            {t('hintBannerSelected')}
          </div>
        ) : (
          <div style={{
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontWeight: 800,
            fontSize: '13px',
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
            color: 'var(--stone)',
            backgroundColor: 'var(--cream)',
            border: '1.5px solid var(--cream-border)',
            padding: '9px 16px',
            borderRadius: '9999px',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>
            {t('hintBannerSelectAll')}
          </div>
        )}
      </div>

      {/* ── Service card grid ───────────────────────────────────────────────── */}
      <div className="svc-grid">
        {/* Reservations */}
        <ServiceCard
          title={t('cards.reservations.title')}
          description={t('cards.reservations.description')}
          selected={flags.service_reservations_enabled}
          onClick={() => handleToggle('service_reservations_enabled')}
          iconBg="var(--sage-bg)"
          iconColor="var(--sage)"
          cornerGlow="radial-gradient(circle, rgba(93,138,58,0.16) 0%, transparent 70%)"
          chipColor="var(--sage)"
          chipBg="var(--sage-bg)"
          chipBorder="rgba(93,138,58,0.22)"
          chips={resvChips}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          }
        />

        {/* Takeaway */}
        <ServiceCard
          title={t('cards.takeaway.title')}
          description={t('cards.takeaway.description')}
          selected={flags.service_takeaway_enabled}
          onClick={() => handleToggle('service_takeaway_enabled')}
          iconBg="var(--burgundy-bg)"
          iconColor="var(--burgundy)"
          cornerGlow="radial-gradient(circle, rgba(161,52,52,0.14) 0%, transparent 70%)"
          chipColor="var(--burgundy)"
          chipBg="var(--burgundy-bg)"
          chipBorder="rgba(161,52,52,0.22)"
          chips={takeChips}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          }
        />

        {/* QR ordering */}
        <ServiceCard
          title={t('cards.qr.title')}
          description={t('cards.qr.description')}
          selected={flags.service_qr_enabled}
          onClick={() => handleToggle('service_qr_enabled')}
          iconBg="var(--amber-bg)"
          iconColor="var(--amber-deep)"
          cornerGlow="radial-gradient(circle, rgba(212,130,10,0.18) 0%, transparent 70%)"
          chipColor="var(--amber-deep)"
          chipBg="var(--amber-bg)"
          chipBorder="rgba(212,130,10,0.22)"
          chips={qrChips}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" />
              <rect x="14" y="3" width="7" height="7" />
              <rect x="3" y="14" width="7" height="7" />
              <path d="M14 14h3v3h-3zM17 17h3v3h-3zM14 20h3" />
            </svg>
          }
        />

        {/* Delivery — coming soon */}
        <DeliveryCard
          title={t('cards.delivery.title')}
          description={t('cards.delivery.description')}
          chips={deliveryChips}
          comingSoonLabel={t('comingSoon')}
          icon={
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="1" y="3" width="15" height="13" />
              <path d="M16 8h4l3 3v5h-7V8z" />
              <circle cx="5.5" cy="18.5" r="2.5" />
              <circle cx="18.5" cy="18.5" r="2.5" />
            </svg>
          }
        />
      </div>
    </StepFrame>
  )
}
