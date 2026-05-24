// components/onboarding/ProgressBar.tsx
//
// 6-segment progress bar shown at the top of every onboarding step page.
//
// Per Phase 1 PRD §C.1:
//   - Current and past segments: amber fill (var(--amber))
//   - Future segments: warm cream fill (var(--warm))
//   - Animated transition between states
//
// Design note: the PRD literally says "animated transition using CSS
// transition on width" but the design is six fixed-width pills, not a
// single growing bar. Animating width on equal segments is a no-op,
// so we animate background-color instead. The visual effect — amber
// flowing left-to-right as the user progresses — is identical.
//
// Server-component-safe: no 'use client', no hooks. Renders identically
// in server and client pages.

type ProgressBarProps = {
  currentStep: number
  totalSteps?: number
  ariaLabel?: string
}

export default function ProgressBar({
  currentStep,
  totalSteps = 6,
  ariaLabel,
}: ProgressBarProps) {
  // Clamp into valid range so a stray prop never breaks rendering.
  const safeTotal = Math.max(1, Math.floor(totalSteps))
  const safeCurrent = Math.min(safeTotal, Math.max(1, Math.floor(currentStep)))

  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={safeTotal}
      aria-valuenow={safeCurrent}
      aria-label={ariaLabel ?? `Step ${safeCurrent} of ${safeTotal}`}
      style={{
        display: 'flex',
        gap: '6px',
        width: '100%',
      }}
    >
      {Array.from({ length: safeTotal }).map((_, i) => {
        const stepNumber = i + 1
        const isCompleteOrCurrent = stepNumber <= safeCurrent
        return (
          <div
            key={stepNumber}
            style={{
              flex: 1,
              height: '4px',
              borderRadius: '2px',
              backgroundColor: isCompleteOrCurrent
                ? 'var(--amber)'
                : 'var(--warm)',
              transition: 'background-color 0.35s ease',
            }}
          />
        )
      })}
    </div>
  )
}
