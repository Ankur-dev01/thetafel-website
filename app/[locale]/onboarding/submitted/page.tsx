import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import StepFrame from '@/components/onboarding/shell/StepFrame'

export const dynamic = 'force-dynamic'

type PageProps = {
  params: Promise<{ locale: 'nl' | 'en' }>
}

const COPY = {
  nl: {
    serviceTag: 'Review',
    heading: 'Ingestuurd',
    leadFallback: 'Bedankt. We hebben je inrichting ontvangen.',
    lead: (name: string) => `Bedankt, ${name}. We hebben je inrichting ontvangen.`,
    body: 'Ons team kijkt je inrichting na — meestal binnen 60 minuten. Je krijgt een e-mail zodra je live bent.',
    timingTitle: 'Wat je daarna kunt verwachten',
    timingReservations: 'Reserveringen — live binnen 60 minuten na goedkeuring.',
    timingTakeaway:
      'Afhalen — live wanneer ons designteam je menu heeft gebouwd, meestal binnen 2 werkdagen.',
    timingQrBasic:
      'QR-bestellen — live wanneer je menu klaar is en je Basic stickers zijn verzonden, meestal binnen 2 werkdagen.',
    timingQrPremium:
      'QR-bestellen — live wanneer je menu klaar is en je Premium kaarten zijn bezorgd, doorgaans 5–7 werkdagen.',
    submittedAt: (when: string) => `Ingestuurd op ${when}`,
  },
  en: {
    serviceTag: 'Review',
    heading: 'Submitted',
    leadFallback: 'Thanks. We have received your setup.',
    lead: (name: string) => `Thanks, ${name}. We have received your setup.`,
    body: 'Our team is reviewing — typically within 60 minutes. You will get an email as soon as you are live.',
    timingTitle: 'What to expect next',
    timingReservations: 'Reservations — live within 60 minutes of approval.',
    timingTakeaway:
      'Takeaway — live once our design team has built your menu, typically within 2 business days.',
    timingQrBasic:
      'QR ordering — live once your menu is built and your Basic stickers ship, typically within 2 business days.',
    timingQrPremium:
      'QR ordering — live once your menu is built and your Premium cards are delivered, usually 5–7 business days.',
    submittedAt: (when: string) => `Submitted on ${when}`,
  },
} as const

export default async function SubmittedPage({ params }: PageProps) {
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
      `id, status, legal_name, trade_name, display_name, submitted_at,
       service_reservations_enabled, service_takeaway_enabled,
       service_qr_enabled, qr_plan`
    )
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!restaurant) {
    redirect(locale === 'en' ? '/en/onboarding' : '/onboarding')
  }

  // Defensive: mid-onboarding users who hit this URL directly go back to review.
  if (restaurant.status === 'onboarding') {
    redirect(locale === 'en' ? '/en/onboarding/review' : '/onboarding/review')
  }

  const displayName =
    restaurant.display_name ?? restaurant.trade_name ?? restaurant.legal_name ?? ''

  const submittedAtFormatted = restaurant.submitted_at
    ? new Date(restaurant.submitted_at).toLocaleString(
        locale === 'en' ? 'en-GB' : 'nl-NL',
        {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }
      )
    : ''

  return (
    <StepFrame
      locale={locale}
      showProgress
      currentStepDisplayNumber={14}
      totalSteps={14}
      serviceTag={t.serviceTag}
      heading={t.heading}
      subHeading={displayName ? t.lead(displayName) : t.leadFallback}
      backHref={null}
      canContinue={false}
      isSubmitting={false}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 640 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
            padding: '20px 22px',
            backgroundColor: '#ffffff',
            border: '1px solid #f0e8d8',
            borderRadius: 16,
          }}
        >
          <span
            aria-hidden
            style={{
              flexShrink: 0,
              width: 36,
              height: 36,
              borderRadius: '50%',
              backgroundColor: '#d4820a',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 9.5L7.5 13L14 5.5"
                stroke="#fdfaf5"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <p
            lang={locale}
            style={{
              margin: 0,
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontSize: 14,
              color: '#1e1508',
              lineHeight: 1.55,
            }}
          >
            {t.body}
          </p>
        </div>

        <div
          style={{
            padding: '20px 22px',
            backgroundColor: 'rgba(248, 242, 230, 0.5)',
            border: '1px solid #f0e8d8',
            borderRadius: 16,
          }}
        >
          <h2
            style={{
              margin: '0 0 12px',
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#9c8b6a',
            }}
          >
            {t.timingTitle}
          </h2>
          <ul
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {restaurant.service_reservations_enabled && (
              <TimingItem text={t.timingReservations} />
            )}
            {restaurant.service_takeaway_enabled && (
              <TimingItem text={t.timingTakeaway} />
            )}
            {restaurant.service_qr_enabled && (
              <TimingItem
                text={
                  restaurant.qr_plan === 'premium'
                    ? t.timingQrPremium
                    : t.timingQrBasic
                }
              />
            )}
          </ul>
        </div>

        {submittedAtFormatted && (
          <p
            style={{
              margin: 0,
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontSize: 12,
              color: '#9c8b6a',
            }}
          >
            {t.submittedAt(submittedAtFormatted)}
          </p>
        )}
      </div>
    </StepFrame>
  )
}

function TimingItem({ text }: { text: string }) {
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        fontFamily: 'var(--font-jost), Jost, sans-serif',
        fontSize: 13,
        color: '#1e1508',
        lineHeight: 1.5,
      }}
    >
      <span
        aria-hidden
        style={{
          flexShrink: 0,
          marginTop: 7,
          width: 6,
          height: 6,
          borderRadius: '50%',
          backgroundColor: '#d4820a',
        }}
      />
      <span>{text}</span>
    </li>
  )
}
