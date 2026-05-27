'use client';

type ProgressBarProps = {
  currentStep: number;
  totalSteps: number;
  ariaLabel?: string;
};

export default function ProgressBar({
  currentStep,
  totalSteps,
  ariaLabel,
}: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(currentStep, totalSteps));
  const pct = totalSteps > 0 ? (clamped / totalSteps) * 100 : 0;

  return (
    <div
      className="w-full h-1 bg-[#f0e8d8] relative overflow-hidden"
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={totalSteps}
      aria-label={ariaLabel ?? 'Onboarding progress'}
    >
      <div
        className="absolute inset-y-0 left-0 transition-all duration-500 ease-out"
        style={{
          width: `${pct}%`,
          background: 'linear-gradient(90deg, #d4820a, #b86d08)',
        }}
      />
    </div>
  );
}
