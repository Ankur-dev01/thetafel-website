'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import StepFrame from '@/components/onboarding/shell/StepFrame'

export type ChecklistRow = {
  key: string
  label: string
  summary: string
}

type Props = {
  locale: 'nl' | 'en'
  restaurantId: string
  restaurantDisplayName: string
  rows: ChecklistRow[]
  initialSubmitted: boolean
  submittedAtIso: string | null
}

const COPY = {
  nl: {
    serviceTag: 'Review',
    heading: 'Controleer en stuur in voor review',
    sub: 'Hieronder zie je een samenvatting van wat je hebt opgezet. Klopt alles? Stuur in en ons team gaat aan de slag.',
    checklistTitle: 'Wat je hebt opgezet',
    submit: 'Insturen voor review',
    submitting: 'Bezig met insturen…',
    errorGeneric: 'Insturen is niet gelukt. Probeer het opnieuw.',
    confHeading: 'Ingestuurd',
    confLead: (name: string) => `Bedankt, ${name}. We hebben je inrichting ontvangen.`,
    confBody:
      'Ons team kijkt je inrichting na — meestal binnen 60 minuten. Je krijgt een e-mail zodra je live bent.',
    confTimingTitle: 'Wat je daarna kunt verwachten',
    confTimingReservations: 'Reserveringen — live binnen 60 minuten na goedkeuring.',
    confTimingTakeaway:
      'Afhalen — live wanneer ons designteam je menu heeft gebouwd, meestal binnen 2 werkdagen.',
    confTimingQrBasic:
      'QR-bestellen — live wanneer je menu klaar is en je Basic stickers zijn verzonden, meestal binnen 2 werkdagen.',
    confTimingQrPremium:
      'QR-bestellen — live wanneer je menu klaar is en je Premium kaarten zijn bezorgd, doorgaans 5–7 werkdagen.',
    confSubmittedAt: (when: string) => `Ingestuurd op ${when}`,
  },
  en: {
    serviceTag: 'Review',
    heading: 'Review and submit for go-live',
    sub: 'Here is a summary of what you have set up. If it all looks right, submit and our team will take it from here.',
    checklistTitle: 'What you have set up',
    submit: 'Submit for review',
    submitting: 'Submitting…',
    errorGeneric: 'Submission failed. Please try again.',
    confHeading: 'Submitted',
    confLead: (name: string) => `Thanks, ${name}. We have received your setup.`,
    confBody:
      'Our team is reviewing — typically within 60 minutes. You will get an email as soon as you are live.',
    confTimingTitle: 'What to expect next',
    confTimingReservations: 'Reservations — live within 60 minutes of approval.',
    confTimingTakeaway:
      'Takeaway — live once our design team has built your menu, typically within 2 business days.',
    confTimingQrBasic:
      'QR ordering — live once your menu is built and your Basic stickers ship, typically within 2 business days.',
    confTimingQrPremium:
      'QR ordering — live once your menu is built and your Premium cards are delivered, usually 5–7 business days.',
    confSubmittedAt: (when: string) => `Submitted on ${when}`,
  },
} as const

export default function ReviewClient({
  locale,
  restaurantId,
  restaurantDisplayName,
  rows,
  initialSubmitted,
  submittedAtIso,
}: Props) {
  const router = useRouter()
  const t = COPY[locale]

  const [submitted, setSubmitted] = useState(initialSubmitted)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submittedAt, setSubmittedAt] = useState<string | null>(submittedAtIso)

  const services = useMemo(() => {
    const has = (k: string) => rows.some((r) => r.key === k)
    const qrRow = rows.find((r) => r.key === 'qr')
    const qrIsPremium = !!qrRow?.summary.toLowerCase().includes('premium')
    return {
      reservations: has('reservations'),
      takeaway: has('takeaway'),
      qr: has('qr'),
      qrIsPremium,
    }
  }, [rows])

  const onSubmit = async () => {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/v1/restaurants/${restaurantId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        error?: string
        detail?: string
        already_submitted?: boolean
        submitted_at?: string
      }
      if (!res.ok || !data.ok) {
        setError(data.detail ?? data.error ?? t.errorGeneric)
        setSubmitting(false)
        return
      }
      setSubmittedAt(data.submitted_at ?? new Date().toISOString())
      setSubmitted(true)
      setSubmitting(false)
      router.refresh()
    } catch (e) {
      console.error('[review] submit failed:', e)
      setError(t.errorGeneric)
      setSubmitting(false)
    }
  }

  const submittedAtFormatted = submittedAt
    ? new Date(submittedAt).toLocaleString(locale === 'en' ? 'en-GB' : 'nl-NL', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : ''

  if (submitted) {
    return (
      <StepFrame
        locale={locale}
        showProgress
        currentStepDisplayNumber={14}
        totalSteps={14}
        serviceTag={t.serviceTag}
        heading={t.confHeading}
        subHeading={t.confLead(restaurantDisplayName)}
        backHref={null}
        canContinue={false}
        isSubmitting={false}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 640 }}>
          <SubmittedHero locale={locale} body={t.confBody} />

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
              {t.confTimingTitle}
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
              {services.reservations && <TimingItem text={t.confTimingReservations} />}
              {services.takeaway && <TimingItem text={t.confTimingTakeaway} />}
              {services.qr && (
                <TimingItem
                  text={services.qrIsPremium ? t.confTimingQrPremium : t.confTimingQrBasic}
                />
              )}
            </ul>
          </div>

          {submittedAt && (
            <p
              style={{
                margin: 0,
                fontFamily: 'var(--font-jost), Jost, sans-serif',
                fontSize: 12,
                color: '#9c8b6a',
              }}
            >
              {t.confSubmittedAt(submittedAtFormatted)}
            </p>
          )}
        </div>
      </StepFrame>
    )
  }

  return (
    <StepFrame
      locale={locale}
      showProgress
      currentStepDisplayNumber={14}
      totalSteps={14}
      serviceTag={t.serviceTag}
      heading={t.heading}
      subHeading={t.sub}
      error={error}
      onDismissError={() => setError(null)}
      backHref={locale === 'en' ? '/en/onboarding/contract' : '/onboarding/contract'}
      onContinue={onSubmit}
      continueLabel={t.submit}
      submittingLabel={t.submitting}
      canContinue={!submitting}
      isSubmitting={submitting}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h2
          style={{
            margin: '0 0 4px',
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: '#9c8b6a',
          }}
        >
          {t.checklistTitle}
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
          {rows.map((row) => (
            <ChecklistRowView key={row.key} row={row} />
          ))}
        </ul>
      </div>
    </StepFrame>
  )
}

function ChecklistRowView({ row }: { row: ChecklistRow }) {
  return (
    <li
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 14,
        padding: '14px 16px',
        backgroundColor: '#ffffff',
        border: '1px solid #f0e8d8',
        borderRadius: 12,
      }}
    >
      <CheckIcon />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span
          style={{
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontSize: 14,
            fontWeight: 500,
            color: '#1e1508',
          }}
        >
          {row.label}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontSize: 13,
            color: '#6b5b3f',
            lineHeight: 1.45,
          }}
        >
          {row.summary}
        </span>
      </div>
    </li>
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

function CheckIcon() {
  return (
    <span
      aria-hidden
      style={{
        flexShrink: 0,
        width: 22,
        height: 22,
        borderRadius: '50%',
        backgroundColor: '#d4820a',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 1,
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M2.5 6.2L4.8 8.5L9.5 3.5"
          stroke="#fdfaf5"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
}

function SubmittedHero({ locale, body }: { locale: 'nl' | 'en'; body: string }) {
  return (
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
        {body}
      </p>
    </div>
  )
}
