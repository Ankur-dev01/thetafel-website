'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import type { Database } from '@/packages/db/types';
import {
  getVisibleSteps,
  getStepStatus,
  resolveStepIdFromPath,
  type StepDescriptor,
} from '@/lib/onboarding/steps';
import LanguageToggle from './LanguageToggle';

type Restaurant = Database['public']['Tables']['restaurants']['Row'];

type OnboardingSidebarProps = {
  locale: 'nl' | 'en';
  restaurant: Restaurant | null;
  currentRouteStepId: number | null;
};

export default function OnboardingSidebar({
  locale,
  restaurant,
  currentRouteStepId,
}: OnboardingSidebarProps) {
  const pathname = usePathname();
  // Derive the active step from the live client pathname so the highlight
  // updates immediately on soft (client-side) navigation without waiting
  // for the server layout to re-render. Fall back to the server-provided
  // value for the initial SSR pass (avoids a highlight flash).
  const liveStepId = resolveStepIdFromPath(pathname) ?? currentRouteStepId;

  const visibleSteps = getVisibleSteps(restaurant);
  const currentOnboardingStep = restaurant?.current_onboarding_step ?? 0;

  const t = {
    nl: {
      eyebrow: 'RESTAURANT SETUP',
      services: 'Geselecteerde diensten',
      help: 'Hulp nodig? Ons team helpt je binnen 60 minuten live — gratis.',
      cta: 'Plan een setup-gesprek',
      svc_reservations: 'Reserveringen',
      svc_takeaway: 'Afhalen',
      svc_qr: 'QR bestellen',
    },
    en: {
      eyebrow: 'RESTAURANT SETUP',
      services: 'Selected services',
      help: 'Need help? Our team gets you live within 60 minutes — free.',
      cta: 'Book a setup call',
      svc_reservations: 'Reservations',
      svc_takeaway: 'Takeaway',
      svc_qr: 'QR ordering',
    },
  }[locale];

  const localePrefix = locale === 'en' ? '/en' : '';

  return (
    <div className="flex flex-col h-full p-6 gap-6">
      {/* Top: wordmark + language toggle */}
      <div className="flex items-start justify-between">
        <div>
          <div
            className="text-[11px] tracking-[0.18em] text-[#d4820a] leading-none"
            style={{
              fontFamily: 'var(--font-raleway), Raleway, sans-serif',
              fontWeight: 900,
            }}
          >
            THE
          </div>
          <div
            className="text-[28px] text-[#fdfaf5] leading-none mt-1"
            style={{
              fontFamily: 'var(--font-raleway), Raleway, sans-serif',
              fontWeight: 900,
            }}
          >
            Tafel
          </div>
          <div
            className="text-[9px] tracking-[0.22em] text-[#9c8b6a] mt-3 uppercase"
            style={{
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontWeight: 600,
            }}
          >
            {t.eyebrow}
          </div>
        </div>
        <LanguageToggle locale={locale} />
      </div>

      {/* Service chips */}
      {restaurant && (
        <ServiceChips
          restaurant={restaurant}
          labels={{
            heading: t.services,
            reservations: t.svc_reservations,
            takeaway: t.svc_takeaway,
            qr: t.svc_qr,
          }}
        />
      )}

      {/* Step list */}
      <nav
        aria-label={locale === 'nl' ? 'Stappen' : 'Steps'}
        className="flex-1 overflow-y-auto"
      >
        <ol className="flex flex-col gap-1">
          {visibleSteps.map((step, index) => {
            const status = getStepStatus(
              step.id,
              currentOnboardingStep,
              liveStepId
            );
            return (
              <li key={step.key}>
                <StepListItem
                  step={step}
                  locale={locale}
                  status={status}
                  displayNumber={index}
                  localePrefix={localePrefix}
                />
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Help text + CTA at the bottom */}
      <div className="border-t border-white/10 pt-4">
        <p
          className="text-[12px] text-[#9c8b6a] leading-relaxed mb-3"
          style={{
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontWeight: 400,
          }}
        >
          {t.help}
        </p>
        <a
          href="mailto:hallo@thetafel.nl?subject=Setup-gesprek"
          className="block w-full text-center px-4 py-2.5 rounded bg-white/10 hover:bg-white/15 text-[#fdfaf5] text-[12px] uppercase tracking-[0.12em] transition-colors"
          style={{
            fontFamily: 'var(--font-jost), Jost, sans-serif',
            fontWeight: 600,
          }}
        >
          {t.cta}
        </a>
      </div>
    </div>
  );
}

function ServiceChips({
  restaurant,
  labels,
}: {
  restaurant: Restaurant;
  labels: { heading: string; reservations: string; takeaway: string; qr: string };
}) {
  const chips: { label: string; bg: string; fg: string }[] = [];
  if (restaurant.service_reservations_enabled) {
    chips.push({ label: labels.reservations, bg: 'rgba(212,130,10,0.18)', fg: '#d4820a' });
  }
  if (restaurant.service_takeaway_enabled) {
    chips.push({ label: labels.takeaway, bg: 'rgba(58,125,68,0.20)', fg: '#5fb46f' });
  }
  if (restaurant.service_qr_enabled) {
    chips.push({ label: labels.qr, bg: 'rgba(139,92,246,0.20)', fg: '#b39bff' });
  }

  if (chips.length === 0) return null;

  return (
    <div>
      <div
        className="text-[9px] tracking-[0.22em] text-[#9c8b6a] uppercase mb-2"
        style={{
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontWeight: 600,
        }}
      >
        {labels.heading}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((c) => (
          <span
            key={c.label}
            className="text-[10px] px-2 py-1 rounded-full uppercase tracking-[0.12em]"
            style={{
              backgroundColor: c.bg,
              color: c.fg,
              fontFamily: 'var(--font-jost), Jost, sans-serif',
              fontWeight: 600,
            }}
          >
            {c.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function StepListItem({
  step,
  locale,
  status,
  displayNumber,
  localePrefix,
}: {
  step: StepDescriptor;
  locale: 'nl' | 'en';
  status: 'completed' | 'current' | 'reachable' | 'unreachable';
  displayNumber: number;
  localePrefix: string;
}) {
  const label = locale === 'nl' ? step.label_nl : step.label_en;
  const href = `${localePrefix}${step.path}`;
  const isClickable = status !== 'unreachable';

  const labelClass =
    status === 'current'
      ? 'text-[#fdfaf5]'
      : status === 'completed'
        ? 'text-[#fdfaf5]/80'
        : status === 'reachable'
          ? 'text-[#fdfaf5]/70 hover:text-[#fdfaf5]'
          : 'text-[#9c8b6a]/60';

  const row = (
    <div
      className={
        'flex items-center gap-3 py-2 px-2 rounded transition-colors ' +
        (status === 'current' ? 'bg-white/5' : isClickable ? 'hover:bg-white/5' : '')
      }
    >
      <StatusIcon status={status} displayNumber={displayNumber} />
      <span
        className={`text-[13px] leading-snug ${labelClass}`}
        style={{
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontWeight: status === 'current' ? 600 : 500,
        }}
      >
        {label}
      </span>
    </div>
  );

  if (!isClickable) {
    return <div aria-disabled="true">{row}</div>;
  }

  return (
    <Link href={href} aria-current={status === 'current' ? 'step' : undefined}>
      {row}
    </Link>
  );
}

function StatusIcon({
  status,
  displayNumber,
}: {
  status: 'completed' | 'current' | 'reachable' | 'unreachable';
  displayNumber: number;
}) {
  const base =
    'w-6 h-6 rounded-full flex items-center justify-center text-[10px] flex-shrink-0';

  if (status === 'completed') {
    return (
      <span
        className={`${base} bg-[#d4820a] text-[#1e1508]`}
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 700 }}
        aria-label="Completed"
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    );
  }

  if (status === 'current') {
    return (
      <span
        className={`${base} border-2 border-[#d4820a] text-[#d4820a]`}
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 700 }}
      >
        {displayNumber}
      </span>
    );
  }

  if (status === 'reachable') {
    return (
      <span
        className={`${base} border border-[#fdfaf5]/30 text-[#fdfaf5]/70`}
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
      >
        {displayNumber}
      </span>
    );
  }

  return (
    <span
      className={`${base} border border-[#9c8b6a]/30 text-[#9c8b6a]/60`}
      style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}
    >
      {displayNumber}
    </span>
  );
}
