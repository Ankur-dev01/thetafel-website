// components/consumer/booking/StepR5.tsx
//
// Step 5 — no-show deposit (conditional; only rendered when visibleSteps
// includes 5, per lib/booking/visibleSteps.ts). Shows the per-guest and
// total deposit amount, the cancellation policy line, and two payment
// buttons (iDEAL primary, card secondary) per PRD §4 R5.
//
// Clicking a button posts to start-deposit, then redirects the browser to
// the returned Mollie checkout URL. The actual payment status is verified
// server-side later by the /return/[intentId] handler (a follow-up unit) —
// this component never trusts anything back from Mollie itself.

'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { BookingConfig } from '@/lib/booking/types';
import { useBookingFlow } from '@/lib/booking/state';

interface Props {
  config: BookingConfig;
}

const AMBER = '#d4820a';
const NIGHT = '#0f0d08';
const CREAM = '#fdfaf5';
const DISABLED_BG = '#e8e4dc';
const DISABLED_TEXT = '#7a7670';
const BORDER = 'rgba(15, 13, 8, 0.15)';

export function StepR5({ config }: Props) {
  const t = useTranslations('booking.r5');
  const locale = useLocale();
  const { draft, setCanContinue } = useBookingFlow();

  const [submittingMethod, setSubmittingMethod] = useState<'ideal' | 'creditcard' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Payment happens off-page (Mollie redirect); this step never "continues"
    // itself — the return handler advances the flow after a verified payment.
    setCanContinue(false);
  }, [setCanContinue]);

  const partySize = draft.partySize ?? 1;
  const perGuestCents = config.noShowPrepaidAmountCents ?? 0;
  const totalCents = perGuestCents * partySize;
  const currencySymbol = config.noShowPrepaidCurrency === 'EUR' ? '€' : config.noShowPrepaidCurrency;

  function formatAmount(cents: number): string {
    return (cents / 100).toFixed(2).replace('.', locale === 'nl' ? ',' : '.');
  }

  async function handlePay(method: 'ideal' | 'creditcard') {
    if (submittingMethod) return;
    setSubmittingMethod(method);
    setError(null);

    const body = {
      slug: config.slug,
      partySize: draft.partySize,
      date: draft.date,
      slotInstant: draft.slotInstant,
      guest: {
        name: draft.guest.name,
        email: draft.guest.email,
        phone: draft.guest.phone,
      },
      method,
      locale,
      turnstileToken: 'dev-bypass-token',
      idempotencyKey: crypto.randomUUID(),
    };

    try {
      const res = await fetch(
        `/api/v1/public/${encodeURIComponent(config.slug)}/book/start-deposit`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const json = await res.json();
      if (!json.ok) {
        const errorKey = `errors.${json.error}`;
        setError(
          t.has(errorKey as Parameters<typeof t>[0])
            ? t(errorKey as Parameters<typeof t>[0])
            : t('errors.generic'),
        );
        setSubmittingMethod(null);
        return;
      }
      if (json.checkoutUrl) {
        window.location.href = json.checkoutUrl;
        return;
      }
      // Already paid (idempotent replay) — the return-handler unit owns
      // advancing the flow in that case. Nothing further to do here yet.
      setSubmittingMethod(null);
    } catch {
      setError(t('errors.generic'));
      setSubmittingMethod(null);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <h2
        style={{
          fontFamily: 'var(--font-raleway), serif',
          fontWeight: 900,
          fontSize: 'clamp(18px, 3vw, 22px)',
          color: NIGHT,
          margin: 0,
        }}
      >
        {t('heading')}
      </h2>

      <p
        style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontSize: 14,
          lineHeight: 1.6,
          color: 'rgba(15, 13, 8, 0.7)',
          margin: 0,
        }}
      >
        {t('intro')}
      </p>

      <div
        style={{
          border: `1px solid ${BORDER}`,
          borderRadius: 8,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          backgroundColor: CREAM,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 14,
            fontFamily: 'var(--font-jost), sans-serif',
          }}
        >
          <span style={{ color: 'rgba(15, 13, 8, 0.7)' }}>
            {t('per_guest_label', { amount: `${currencySymbol} ${formatAmount(perGuestCents)}` })}
          </span>
          <span style={{ color: 'rgba(15, 13, 8, 0.7)' }}>× {partySize}</span>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 18,
            fontWeight: 700,
            fontFamily: 'var(--font-jost), sans-serif',
            color: NIGHT,
            paddingTop: 8,
            borderTop: `1px solid ${BORDER}`,
          }}
        >
          <span>{t('total_label')}</span>
          <span>
            {currencySymbol} {formatAmount(totalCents)}
          </span>
        </div>
      </div>

      <p
        style={{
          fontFamily: 'var(--font-jost), sans-serif',
          fontSize: 13,
          lineHeight: 1.6,
          color: 'rgba(15, 13, 8, 0.55)',
          margin: 0,
        }}
      >
        {t('cancellation_policy')}
      </p>

      {error && (
        <p
          style={{
            fontFamily: 'var(--font-jost), sans-serif',
            fontSize: 13,
            color: '#b91c1c',
            margin: 0,
          }}
        >
          {error}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button
          type="button"
          onClick={() => handlePay('ideal')}
          disabled={submittingMethod !== null}
          style={{
            backgroundColor: submittingMethod !== null ? DISABLED_BG : AMBER,
            color: submittingMethod !== null ? DISABLED_TEXT : '#ffffff',
            border: 'none',
            borderRadius: 6,
            padding: '12px 20px',
            fontSize: 15,
            fontWeight: 600,
            fontFamily: 'var(--font-jost), sans-serif',
            cursor: submittingMethod !== null ? 'not-allowed' : 'pointer',
            transition: 'background-color 120ms',
          }}
        >
          {submittingMethod === 'ideal' ? t('processing') : t('pay_ideal')}
        </button>

        <button
          type="button"
          onClick={() => handlePay('creditcard')}
          disabled={submittingMethod !== null}
          style={{
            backgroundColor: 'transparent',
            color: submittingMethod !== null ? DISABLED_TEXT : NIGHT,
            border: `1px solid ${submittingMethod !== null ? DISABLED_BG : BORDER}`,
            borderRadius: 6,
            padding: '12px 20px',
            fontSize: 15,
            fontWeight: 600,
            fontFamily: 'var(--font-jost), sans-serif',
            cursor: submittingMethod !== null ? 'not-allowed' : 'pointer',
            transition: 'background-color 120ms',
          }}
        >
          {submittingMethod === 'creditcard' ? t('processing') : t('pay_card')}
        </button>
      </div>
    </div>
  );
}
