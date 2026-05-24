// components/onboarding/StepLayout.tsx
//
// Visual frame for every onboarding step page (Steps 1 through 6).
// Renders, in order:
//   1. Logo
//   2. ProgressBar (6 segments; current step highlighted amber)
//   3. Eyebrow line — small uppercase label, e.g. "Stap 2 van 6 — Locatie"
//   4. Heading — the step's question, e.g. "Waar is je restaurant?"
//   5. Children — the step's form fields
//   6. Button row — Back (left) and Continue (right)
//
// Per Phase 1 PRD §C.1:
//   - Continue is disabled by default. Each page passes canContinue={true}
//     once its required fields are valid.
//   - Step 1 has no Back button (pass backHref={null}).
//
// Cream background. Card uses --warm. Earth text. Amber accent on Continue.
// Matches the locked set-password page styling so Phase B + Phase C feel
// like one continuous flow.

'use client'

import { useParams } from 'next/navigation'
import Link from 'next/link'
import ProgressBar from './ProgressBar'

type StepLayoutProps = {
  /** 1-indexed step number, 1 through 6. */
  currentStep: number
  /** Total steps. Defaults to 6. */
  totalSteps?: number
  /** Small uppercase label above the heading. */
  eyebrow: string
  /** Big Raleway 900 question. */
  heading: string
  /** Optional sub-paragraph below the heading. */
  sub?: string
  /** Path to navigate back to. Pass null on Step 1 to hide the Back button. */
  backHref: string | null
  /** Continue button label. Defaults to "Doorgaan" / "Continue". */
  continueLabel: string
  /** Submitting label shown while onContinue is in flight. */
  submittingLabel?: string
  /** Whether Continue is enabled. Default false — page opts in. */
  canContinue: boolean
  /** Whether the Continue handler is currently running. */
  isSubmitting?: boolean
  /** Click handler for Continue. */
  onContinue: () => void | Promise<void>
  /** Optional inline error shown above the button row. */
  error?: string | null
  /** The step's form fields. */
  children: React.ReactNode
}

export default function StepLayout({
  currentStep,
  totalSteps = 6,
  eyebrow,
  heading,
  sub,
  backHref,
  continueLabel,
  submittingLabel,
  canContinue,
  isSubmitting = false,
  onContinue,
  error,
  children,
}: StepLayoutProps) {
  const params = useParams()
  const locale = (params?.locale as string) === 'en' ? 'en' : 'nl'
  const tBack = locale === 'en' ? 'Back' : 'Terug'

  const handleContinueClick = () => {
    if (!canContinue || isSubmitting) return
    void onContinue()
  }

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
      <div
        style={{
          width: '100%',
          maxWidth: '560px',
          margin: '0 auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px', marginTop: '16px' }}>
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

        {/* Progress bar */}
        <div style={{ marginBottom: '32px' }}>
          <ProgressBar
            currentStep={currentStep}
            totalSteps={totalSteps}
            ariaLabel={
              locale === 'en'
                ? `Step ${currentStep} of ${totalSteps}`
                : `Stap ${currentStep} van ${totalSteps}`
            }
          />
        </div>

        {/* Card */}
        <div
          style={{
            backgroundColor: 'var(--warm)',
            borderRadius: '24px',
            padding: '40px 36px',
            flex: 'none',
          }}
        >
          {/* Eyebrow */}
          <p
            style={{
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: '11px',
              fontWeight: 600,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: 'var(--amber)',
              marginBottom: '12px',
              marginTop: 0,
            }}
          >
            {eyebrow}
          </p>

          {/* Heading */}
          <h1
            style={{
              fontFamily: 'var(--font-raleway), sans-serif',
              fontWeight: 900,
              fontSize: '32px',
              letterSpacing: '-0.02em',
              color: 'var(--earth)',
              lineHeight: 1.1,
              marginTop: 0,
              marginBottom: sub ? '12px' : '32px',
            }}
          >
            {heading}
          </h1>

          {/* Optional sub */}
          {sub && (
            <p
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '14px',
                fontWeight: 300,
                lineHeight: 1.7,
                color: 'var(--stone)',
                marginTop: 0,
                marginBottom: '32px',
              }}
            >
              {sub}
            </p>
          )}

          {/* Step content */}
          <div>{children}</div>

          {/* Inline error */}
          {error && (
            <div
              style={{
                marginTop: '20px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '12px',
                padding: '12px 16px',
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '13px',
                color: '#dc2626',
              }}
            >
              {error}
            </div>
          )}
        </div>

        {/* Button row */}
        <div
          style={{
            marginTop: '24px',
            display: 'flex',
            flexDirection: 'column-reverse',
            gap: '12px',
          }}
          className="step-layout-button-row"
        >
          {backHref ? (
            <Link
              href={backHref}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '14px 24px',
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: '14px',
                fontWeight: 500,
                letterSpacing: '0.05em',
                color: 'var(--stone)',
                backgroundColor: 'transparent',
                border: '1px solid rgba(156,139,106,0.25)',
                borderRadius: '12px',
                textDecoration: 'none',
                textAlign: 'center',
                transition: 'border-color 0.2s ease, color 0.2s ease',
              }}
            >
              {tBack}
            </Link>
          ) : (
            // Spacer keeps the Continue button right-aligned on wide screens
            // even when there is no Back button.
            <div aria-hidden="true" />
          )}

          <button
            type="button"
            onClick={handleContinueClick}
            disabled={!canContinue || isSubmitting}
            style={{
              padding: '14px 28px',
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: '14px',
              fontWeight: 600,
              letterSpacing: '0.05em',
              color: '#ffffff',
              backgroundColor:
                !canContinue || isSubmitting
                  ? 'rgba(212,130,10,0.45)'
                  : 'var(--amber)',
              border: 'none',
              borderRadius: '12px',
              cursor: !canContinue || isSubmitting ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s ease',
            }}
          >
            {isSubmitting && submittingLabel ? submittingLabel : continueLabel}
          </button>
        </div>

        {/* Responsive: side-by-side on >=640px, Continue on the right */}
        <style jsx>{`
          @media (min-width: 640px) {
            :global(.step-layout-button-row) {
              flex-direction: row !important;
              justify-content: space-between !important;
            }
            :global(.step-layout-button-row > *) {
              flex: 1;
              max-width: 240px;
            }
            :global(.step-layout-button-row > button) {
              margin-left: auto;
            }
          }
        `}</style>
      </div>
    </main>
  )
}
