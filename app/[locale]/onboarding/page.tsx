// app/[locale]/onboarding/page.tsx
//
// Placeholder Step 1 page for Phase C.1 verification.
//
// Real implementation: Phase C.2 — KVK number autofill (one input → typeahead
// → select business → auto-fill identity fields → confirm). See the team
// decision in the Phase C kickoff prompt.
//
// For now this page exists only to:
//   - exercise the /onboarding layout's three guard redirects
//   - render the ProgressBar at segment 1 (amber) of 6
//   - render StepLayout's card with disabled Continue button
//
// 'use client' because StepLayout is a client component and we are rendering
// it directly. The actual Step 1 in C.2 will also be a client page (form
// state + KVK typeahead).

'use client'

import { useParams } from 'next/navigation'
import StepLayout from '@/components/onboarding/StepLayout'

export default function OnboardingStep1Placeholder() {
  const params = useParams()
  const locale = (params?.locale as string) === 'en' ? 'en' : 'nl'

  const copy =
    locale === 'en'
      ? {
          eyebrow: 'Step 1 of 6 — Identity',
          heading: 'Find your business.',
          sub: 'In the next step we will look up your business in the Dutch Chamber of Commerce register and pre-fill your details. Coming in C.2.',
          placeholder:
            'KVK lookup will appear here in C.2. This page is currently a placeholder for verifying onboarding guards and layout.',
          continueLabel: 'Continue',
        }
      : {
          eyebrow: 'Stap 1 van 6 — Identiteit',
          heading: 'Vind je bedrijf.',
          sub: 'In de volgende stap zoeken we je bedrijf op in het KVK-register en vullen we je gegevens automatisch in. Beschikbaar in C.2.',
          placeholder:
            'KVK-zoekopdracht verschijnt hier in C.2. Deze pagina is voorlopig een placeholder om de onboarding-guards en de layout te verifiëren.',
          continueLabel: 'Doorgaan',
        }

  return (
    <StepLayout
      currentStep={1}
      totalSteps={6}
      eyebrow={copy.eyebrow}
      heading={copy.heading}
      sub={copy.sub}
      backHref={null}
      continueLabel={copy.continueLabel}
      canContinue={false}
      isSubmitting={false}
      onContinue={() => {
        /* placeholder — wired up in C.2 */
      }}
    >
      <div
        style={{
          padding: '20px 18px',
          borderRadius: '12px',
          backgroundColor: 'rgba(212,130,10,0.08)',
          border: '1px dashed rgba(212,130,10,0.35)',
          fontFamily: 'var(--font-jost), sans-serif',
          fontSize: '13px',
          fontWeight: 400,
          lineHeight: 1.6,
          color: 'var(--stone)',
        }}
      >
        {copy.placeholder}
      </div>
    </StepLayout>
  )
}
