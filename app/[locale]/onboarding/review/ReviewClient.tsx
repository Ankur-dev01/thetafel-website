'use client'

import { useState } from 'react'
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
  rows: ChecklistRow[]
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
  },
  en: {
    serviceTag: 'Review',
    heading: 'Review and submit for go-live',
    sub: 'Here is a summary of what you have set up. If it all looks right, submit and our team will take it from here.',
    checklistTitle: 'What you have set up',
    submit: 'Submit for review',
    submitting: 'Submitting…',
    errorGeneric: 'Submission failed. Please try again.',
  },
} as const

export default function ReviewClient({ locale, restaurantId, rows }: Props) {
  const router = useRouter()
  const t = COPY[locale]

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submittedHref =
    locale === 'en' ? '/en/onboarding/submitted' : '/onboarding/submitted'

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
      }
      if (!res.ok || !data.ok) {
        setError(data.detail ?? data.error ?? t.errorGeneric)
        setSubmitting(false)
        return
      }
      // Navigate to the dedicated submitted page. The shell also catches any
      // future /onboarding/* visit and routes there while status = pending_review.
      router.replace(submittedHref)
    } catch (e) {
      console.error('[review] submit failed:', e)
      setError(t.errorGeneric)
      setSubmitting(false)
    }
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
      backHref={
        locale === 'en' ? '/en/onboarding/contract' : '/onboarding/contract'
      }
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
