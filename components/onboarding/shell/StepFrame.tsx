'use client';

import Link from 'next/link';
import ProgressBar from './ProgressBar';
import ErrorBanner from './ErrorBanner';

type StepFrameProps = {
  locale: 'nl' | 'en';
  showProgress?: boolean;
  currentStepDisplayNumber: number;
  totalSteps: number;
  serviceTag?: string;
  eyebrowLabel?: string;
  heading: string;
  subHeading?: string;
  error?: string | null;
  onDismissError?: () => void;
  backHref: string | null;
  continueHref?: string;
  onContinue?: () => void | Promise<void>;
  canContinue: boolean;
  isSubmitting?: boolean;
  continueLabel?: string;
  submittingLabel?: string;
  savedIndicator?: React.ReactNode;
  children: React.ReactNode;
};

export default function StepFrame({
  locale,
  showProgress = true,
  currentStepDisplayNumber,
  totalSteps,
  serviceTag,
  eyebrowLabel,
  heading,
  subHeading,
  error,
  onDismissError,
  backHref,
  continueHref,
  onContinue,
  canContinue,
  isSubmitting = false,
  continueLabel,
  submittingLabel,
  savedIndicator,
  children,
}: StepFrameProps) {
  const t = {
    nl: {
      stepOf: (n: number, total: number) => `Stap ${n} van ${total}`,
      back: 'Terug',
      continue: 'Doorgaan',
      submitting: 'Bezig…',
    },
    en: {
      stepOf: (n: number, total: number) => `Step ${n} of ${total}`,
      back: 'Back',
      continue: 'Continue',
      submitting: 'Saving…',
    },
  }[locale];

  const eyebrow =
    eyebrowLabel ??
    (`${t.stepOf(currentStepDisplayNumber, totalSteps)}` +
      (serviceTag ? ` — ${serviceTag}` : ''));

  const finalContinueLabel = continueLabel ?? t.continue;
  const finalSubmittingLabel = submittingLabel ?? t.submitting;

  const handleContinueClick = () => {
    if (!canContinue || isSubmitting || !onContinue) return;
    void onContinue();
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#fdfaf5]">
      {showProgress && (
        <ProgressBar
          currentStep={currentStepDisplayNumber}
          totalSteps={totalSteps}
          ariaLabel={eyebrow}
        />
      )}

      <div className="flex-1 flex flex-col px-6 md:px-12 lg:px-16 py-10">
        <div className="w-full max-w-[720px] mx-auto flex-1 flex flex-col gap-8">
          <div className="flex flex-col gap-3">
            {showProgress && (
              <div
                className="text-[10px] uppercase tracking-[0.22em] text-[#d4820a]"
                style={{
                  fontFamily: 'var(--font-jost), Jost, sans-serif',
                  fontWeight: 600,
                }}
              >
                {eyebrow}
              </div>
            )}
            <h1
              className="text-[32px] md:text-[36px] leading-tight text-[#1e1508]"
              style={{
                fontFamily: 'var(--font-raleway), Raleway, sans-serif',
                fontWeight: 900,
              }}
            >
              {heading}
            </h1>
            {subHeading && (
              <p
                className="text-[15px] md:text-[16px] text-[#9c8b6a] leading-relaxed max-w-[600px]"
                style={{
                  fontFamily: 'var(--font-jost), Jost, sans-serif',
                  fontWeight: 300,
                }}
              >
                {subHeading}
              </p>
            )}
          </div>

          {error && <ErrorBanner message={error} onDismiss={onDismissError} />}

          <div className="flex-1">{children}</div>
        </div>
      </div>

      {/* Sticky footer — hidden on terminal pages (no back, no continue) */}
      {(backHref || onContinue) && (
        <div className="sticky bottom-0 bg-[#fdfaf5] border-t border-[#f0e8d8]">
          <div className="w-full max-w-[720px] mx-auto px-6 md:px-12 lg:px-16 py-4 flex items-center justify-between gap-4">
            <div className="flex-shrink-0 min-w-[80px]">
              {backHref ? (
                <Link
                  href={backHref}
                  className="inline-flex items-center gap-1.5 text-[13px] text-[#9c8b6a] hover:text-[#1e1508] transition-colors"
                  style={{
                    fontFamily: 'var(--font-jost), Jost, sans-serif',
                    fontWeight: 500,
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <line x1="19" y1="12" x2="5" y2="12" />
                    <polyline points="12 19 5 12 12 5" />
                  </svg>
                  {t.back}
                </Link>
              ) : (
                <span className="block" aria-hidden="true">&nbsp;</span>
              )}
            </div>

            {/* Saved indicator slot — filled by D1.5 */}
            <div className="flex-1 flex justify-center min-h-[24px]">
              {savedIndicator ?? null}
            </div>

            <div className="flex-shrink-0">
              <ContinueButton
                href={continueHref}
                onClick={handleContinueClick}
                enabled={canContinue && !isSubmitting}
                isSubmitting={isSubmitting}
                label={finalContinueLabel}
                submittingLabel={finalSubmittingLabel}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ContinueButton({
  href,
  onClick,
  enabled,
  isSubmitting,
  label,
  submittingLabel,
}: {
  href?: string;
  onClick: () => void;
  enabled: boolean;
  isSubmitting: boolean;
  label: string;
  submittingLabel: string;
}) {
  const baseClass =
    'inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-[14px] uppercase tracking-[0.12em] transition-all';
  const enabledClass =
    'bg-[#d4820a] text-[#fdfaf5] hover:bg-[#b86d08] shadow-sm hover:shadow';
  const disabledClass = 'bg-[#f0e8d8] text-[#9c8b6a]/60 cursor-not-allowed';
  const className = `${baseClass} ${enabled ? enabledClass : disabledClass}`;
  const style = {
    fontFamily: 'var(--font-jost), Jost, sans-serif',
    fontWeight: 600,
  } as const;

  if (href && enabled) {
    return (
      <Link href={href} className={className} style={style}>
        {label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!enabled}
      aria-disabled={!enabled}
      className={className}
      style={style}
    >
      {isSubmitting ? submittingLabel : label}
    </button>
  );
}
