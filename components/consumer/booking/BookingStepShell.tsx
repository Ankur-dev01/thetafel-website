// components/consumer/booking/BookingStepShell.tsx
//
// The interactive booking shell. Renders chrome (back-to-restaurant link,
// title, progress dots, step counter, footer button row) plus a slot for
// step content. C4.2 ships a placeholder body; C4.3+ fills it.

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useBookingFlow } from '@/lib/booking/state';
import { BookingProgressDots } from './BookingProgressDots';

interface Props {
  restaurantName: string;
  /** Full locale-prefixed path back to the restaurant page, e.g. `/nl/r/draft-abc`. */
  restaurantHref: string;
}

export function BookingStepShell({ restaurantName, restaurantHref }: Props) {
  const shared = useTranslations('booking.shared');
  const shell = useTranslations('booking.shell');
  const { step, totalSteps, goBack } = useBookingFlow();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 40 }}>
      {/* Back-to-restaurant link */}
      <div>
        <Link
          href={restaurantHref}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 14,
            color: 'rgba(15, 13, 8, 0.65)',
            textDecoration: 'none',
            fontFamily: 'var(--font-jost), sans-serif',
            transition: 'color 0.15s ease',
          }}
        >
          <ChevronLeft />
          <span>{shell('back_to_restaurant')}</span>
        </Link>
      </div>

      {/* Heading */}
      <header style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1
          style={{
            fontFamily: 'var(--font-raleway), serif',
            fontWeight: 900,
            fontSize: 'clamp(28px, 5vw, 38px)',
            lineHeight: 1.05,
            color: 'var(--night, #0f0d08)',
            margin: 0,
          }}
        >
          {shell('title')}
        </h1>
        <p
          style={{
            fontSize: 16,
            color: 'rgba(15, 13, 8, 0.65)',
            fontFamily: 'var(--font-jost), sans-serif',
            fontWeight: 400,
            margin: 0,
          }}
        >
          {shell('subtitle_at', { name: restaurantName })}
        </p>
      </header>

      {/* Progress: dots + counter */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <BookingProgressDots current={step} total={totalSteps} />
        <p
          style={{
            fontSize: 11,
            fontFamily: 'var(--font-jost), sans-serif',
            fontWeight: 600,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(15, 13, 8, 0.45)',
            margin: 0,
          }}
        >
          {shared('step_of', { current: step, total: totalSteps })}
        </p>
      </div>

      {/* Step content slot — placeholder until C4.3 */}
      <section
        aria-live="polite"
        style={{
          minHeight: 280,
          borderRadius: 8,
          backgroundColor: 'rgba(253, 250, 245, 0.7)',
          border: '1px solid rgba(156, 139, 106, 0.15)',
          padding: '32px 28px',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <p
          style={{
            fontSize: 14,
            color: 'rgba(15, 13, 8, 0.4)',
            fontFamily: 'var(--font-jost), sans-serif',
            margin: 0,
          }}
        >
          {shell('placeholder_body')}
        </p>
      </section>

      {/* Footer button row */}
      <footer
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 16,
        }}
      >
        <button
          type="button"
          onClick={goBack}
          disabled={step <= 1}
          style={{
            background: 'none',
            border: 'none',
            cursor: step <= 1 ? 'not-allowed' : 'pointer',
            fontSize: 14,
            fontFamily: 'var(--font-jost), sans-serif',
            color: 'rgba(15, 13, 8, 0.65)',
            opacity: step <= 1 ? 0.3 : 1,
            padding: '8px 0',
            transition: 'opacity 0.15s ease, color 0.15s ease',
          }}
        >
          {shared('back')}
        </button>
        <button
          type="button"
          disabled
          style={{
            background: 'var(--amber, #d4820a)',
            border: 'none',
            borderRadius: 6,
            cursor: 'not-allowed',
            opacity: 0.4,
            color: '#fff',
            fontSize: 14,
            fontFamily: 'var(--font-jost), sans-serif',
            fontWeight: 600,
            padding: '10px 28px',
          }}
        >
          {shared('continue')}
        </button>
      </footer>
    </div>
  );
}

function ChevronLeft() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M15 18l-6-6 6-6" />
    </svg>
  );
}
