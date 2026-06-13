import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import StepFrame from '@/components/onboarding/shell/StepFrame'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ locale: 'nl' | 'en' }>
}

const DASHBOARD_URL =
  process.env.NEXT_PUBLIC_DASHBOARD_URL ?? 'https://app.thetafel.nl/login'

const COPY = {
  nl: {
    serviceTag: 'Live',
    heading: (name: string) =>
      name ? `Welkom bij The Tafel, ${name}` : 'Welkom bij The Tafel',
    sub: 'Je bent live. Hieronder zie je wat er nu beschikbaar is en wat er nog komt.',

    reservationsTitle: 'Reserveringen',
    reservationsLiveLabel: 'Live',
    reservationsAt: 'Je reserveringspagina staat op',
    reservationsOpen: 'Bekijk pagina',

    takeawayTitle: 'Afhalen',
    takeawayPendingLabel: 'In voorbereiding',
    takeawayDetail:
      'Live wanneer ons designteam je menu heeft gebouwd — meestal binnen 2 werkdagen. Je krijgt een e-mail zodra het klaar is.',

    qrTitle: 'QR-bestellen',
    qrPendingLabel: 'In voorbereiding',
    qrBasicDetail:
      'Live wanneer je menu klaar is en je Basic stickers zijn verzonden — meestal binnen 2 werkdagen.',
    qrPremiumDetail:
      'Live wanneer je menu klaar is en je Premium kaarten zijn bezorgd — doorgaans 5–7 werkdagen.',

    dashboardCta: 'Open je restaurant-webapp',
    dashboardHint:
      'In je webapp beheer je reserveringen, openingstijden en alle dagelijkse instellingen.',

    wentLiveAt: (when: string) => `Live sinds ${when}`,
  },
  en: {
    serviceTag: 'Live',
    heading: (name: string) =>
      name ? `Welcome to The Tafel, ${name}` : 'Welcome to The Tafel',
    sub: 'You are live. Here is what is available right now and what is still coming.',

    reservationsTitle: 'Reservations',
    reservationsLiveLabel: 'Live',
    reservationsAt: 'Your reservation page is at',
    reservationsOpen: 'View page',

    takeawayTitle: 'Takeaway',
    takeawayPendingLabel: 'In progress',
    takeawayDetail:
      'Live once our design team has built your menu — typically within 2 business days. You will get an email as soon as it is ready.',

    qrTitle: 'QR ordering',
    qrPendingLabel: 'In progress',
    qrBasicDetail:
      'Live once your menu is built and your Basic stickers ship — typically within 2 business days.',
    qrPremiumDetail:
      'Live once your menu is built and your Premium cards are delivered — usually 5–7 business days.',

    dashboardCta: 'Open your restaurant web app',
    dashboardHint:
      'Your web app is where you manage reservations, opening hours, and everyday settings.',

    wentLiveAt: (when: string) => `Live since ${when}`,
  },
} as const

export default async function LivePage({ params }: PageProps) {
  const { locale: rawLocale } = await params
  const locale: 'nl' | 'en' = rawLocale === 'en' ? 'en' : 'nl'
  const t = COPY[locale]

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(locale === 'en' ? '/en/login' : '/login')
  }

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select(
      `id, status, slug, legal_name, trade_name, display_name, went_live_at,
       service_reservations_enabled, service_takeaway_enabled,
       service_qr_enabled, qr_plan`
    )
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!restaurant) {
    redirect(locale === 'en' ? '/en/onboarding' : '/onboarding')
  }

  // Defensive routing — the shell handles these too, but be robust if a user
  // lands here directly.
  if (restaurant.status === 'onboarding') {
    redirect(locale === 'en' ? '/en/onboarding' : '/onboarding')
  }
  if (restaurant.status === 'pending_review') {
    redirect(
      locale === 'en' ? '/en/onboarding/submitted' : '/onboarding/submitted'
    )
  }
  if (
    restaurant.status === 'suspended' ||
    restaurant.status === 'cancelled'
  ) {
    redirect(locale === 'en' ? '/en/login' : '/login')
  }

  const displayName =
    restaurant.display_name ?? restaurant.trade_name ?? restaurant.legal_name ?? ''

  const publicReservationsUrl = restaurant.slug
    ? `https://thetafel.nl/${restaurant.slug}`
    : null

  const wentLiveFormatted = restaurant.went_live_at
    ? new Date(restaurant.went_live_at).toLocaleString(
        locale === 'en' ? 'en-GB' : 'nl-NL',
        { year: 'numeric', month: 'long', day: 'numeric' }
      )
    : ''

  return (
    <StepFrame
      locale={locale}
      showProgress={false}
      currentStepDisplayNumber={14}
      totalSteps={14}
      serviceTag={t.serviceTag}
      heading={t.heading(displayName)}
      subHeading={t.sub}
      backHref={null}
      canContinue={false}
      isSubmitting={false}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 28, maxWidth: 680 }}>
        {/* ── Reservations — live now ─────────────────────────────────── */}
        {restaurant.service_reservations_enabled && (
          <ServiceCard
            variant="live"
            title={t.reservationsTitle}
            statusLabel={t.reservationsLiveLabel}
          >
            {publicReservationsUrl ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span
                  style={{
                    fontFamily: 'var(--font-jost), Jost, sans-serif',
                    fontSize: 13,
                    color: '#6b5b3f',
                  }}
                >
                  {t.reservationsAt}
                </span>
                <a
                  href={publicReservationsUrl}
                  style={{
                    fontFamily: 'var(--font-jost), Jost, sans-serif',
                    fontSize: 15,
                    fontWeight: 500,
                    color: '#d4820a',
                    textDecoration: 'underline',
                    textDecorationThickness: '1px',
                    textUnderlineOffset: '3px',
                    wordBreak: 'break-all',
                  }}
                >
                  thetafel.nl/{restaurant.slug}
                </a>
                <a
                  href={publicReservationsUrl}
                  style={{
                    alignSelf: 'flex-start',
                    fontFamily: 'var(--font-jost), Jost, sans-serif',
                    fontSize: 12,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#1e1508',
                    padding: '8px 14px',
                    border: '1px solid #1e1508',
                    borderRadius: 999,
                    textDecoration: 'none',
                    marginTop: 4,
                  }}
                >
                  {t.reservationsOpen}
                </a>
              </div>
            ) : null}
          </ServiceCard>
        )}

        {/* ── Takeaway — pending ──────────────────────────────────────── */}
        {restaurant.service_takeaway_enabled && (
          <ServiceCard
            variant="pending"
            title={t.takeawayTitle}
            statusLabel={t.takeawayPendingLabel}
          >
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--font-jost), Jost, sans-serif',
                fontSize: 14,
                color: '#6b5b3f',
                lineHeight: 1.55,
              }}
            >
              {t.takeawayDetail}
            </p>
          </ServiceCard>
        )}

        {/* ── QR ordering — pending ───────────────────────────────────── */}
        {restaurant.service_qr_enabled && (
          <ServiceCard
            variant="pending"
            title={t.qrTitle}
            statusLabel={t.qrPendingLabel}
          >
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--font-jost), Jost, sans-serif',
                fontSize: 14,
                color: '#6b5b3f',
                lineHeight: 1.55,
              }}
            >
              {restaurant.qr_plan === 'premium'
                ? t.qrPremiumDetail
                : t.qrBasicDetail}
            </p>
          </ServiceCard>
        )}

        {/* ── Open web app CTA ────────────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: '24px 24px',
            backgroundColor: '#1e1508',
            borderRadius: 18,
            marginTop: 4,
          }}
        >
          <a
            href={DASHBOARD_URL}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              alignSelf: 'flex-start',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontSize: 14,
              fontWeight: 600,
              color: '#1e1508',
              backgroundColor: '#d4820a',
              padding: '14px 22px',
              borderRadius: 999,
              textDecoration: 'none',
            }}
          >
            <span>{t.dashboardCta}</span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden
            >
              <path
                d="M3 7H11M11 7L7.5 3.5M11 7L7.5 10.5"
                stroke="#1e1508"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </a>
          <p
            style={{
              margin: '8px 0 0',
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontSize: 13,
              color: 'rgba(253, 250, 245, 0.7)',
              lineHeight: 1.55,
            }}
          >
            {t.dashboardHint}
          </p>
        </div>

        {wentLiveFormatted && (
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontSize: 12,
              color: '#9c8b6a',
            }}
          >
            {t.wentLiveAt(wentLiveFormatted)}
          </p>
        )}
      </div>
    </StepFrame>
  )
}

function ServiceCard({
  variant,
  title,
  statusLabel,
  children,
}: {
  variant: 'live' | 'pending'
  title: string
  statusLabel: string
  children: React.ReactNode
}) {
  const isLive = variant === 'live'
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        padding: '20px 22px',
        backgroundColor: isLive ? '#ffffff' : 'rgba(248, 242, 230, 0.5)',
        border: '1px solid #f0e8d8',
        borderRadius: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span
          aria-hidden
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            backgroundColor: isLive ? '#d4820a' : 'rgba(212, 130, 10, 0.18)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {isLive ? (
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M3 7.5L6 10L11 4.5"
                stroke="#fdfaf5"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          ) : (
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#d4820a',
              }}
            />
          )}
        </span>

        <div
          style={{
            flex: 1,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 12,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontFamily: 'var(--font-raleway), Raleway, sans-serif',
              fontWeight: 900,
              fontSize: 18,
              color: '#1e1508',
              letterSpacing: '0.005em',
            }}
          >
            {title}
          </h3>
          <span
            style={{
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.16em',
              textTransform: 'uppercase',
              color: isLive ? '#d4820a' : '#9c8b6a',
            }}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      <div style={{ paddingLeft: 40 }}>{children}</div>
    </div>
  )
}
