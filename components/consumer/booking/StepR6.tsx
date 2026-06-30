'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import type { BookingConfig } from '@/lib/booking/types';
import type { ConsumerZone } from '@/lib/booking/zones';
import { useBookingFlow } from '@/lib/booking/state';

interface Props {
  config: BookingConfig;
  zones: ConsumerZone[];
}

interface ErrorDetail {
  stage?: string;
  code?: string;
  message?: string;
  hint?: string;
  details?: string;
}

const AMBER = '#d4820a';
const AMBER_HOVER = '#b8710a';
const NIGHT = '#1a1a1a';
const WHITE = '#ffffff';
const DISABLED_BG = '#e8e4dc';
const DISABLED_TEXT = '#7a7670';

export function StepR6({ config, zones }: Props) {
  const t = useTranslations('booking.r6');
  const locale = useLocale();
  const router = useRouter();
  const { draft, setCanContinue } = useBookingFlow();

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorDetail, setErrorDetail] = useState<ErrorDetail | null>(null);
  const [isHover, setIsHover] = useState(false);

  useEffect(() => {
    setCanContinue(false);
  }, [setCanContinue]);

  const zoneLabel = useMemo(() => {
    if (!draft.zoneId) return t('zone_no_preference');
    return zones.find((z) => z.id === draft.zoneId)?.name ?? t('zone_no_preference');
  }, [draft.zoneId, zones, t]);

  const slotLabel = useMemo(() => {
    if (!draft.slotInstant) return '';
    return new Intl.DateTimeFormat(locale === 'nl' ? 'nl' : 'en', {
      timeZone: 'Europe/Amsterdam',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(new Date(draft.slotInstant));
  }, [draft.slotInstant, locale]);

  async function handleConfirm() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setErrorDetail(null);

    const body = {
      slug: config.slug,
      partySize: draft.partySize,
      date: draft.date,
      slotInstant: draft.slotInstant,
      zoneId: draft.zoneId,
      selectedSlotZoneIds: draft.selectedSlotZoneIds,
      guest: {
        name: draft.guest.name,
        email: draft.guest.email,
        phone: draft.guest.phone,
        note: draft.guest.note,
      },
      allergies: draft.guest.allergies,
      occasion: draft.guest.occasion,
      requests: draft.guest.requests,
      marketingConsent: draft.marketingConsent,
      locale,
      turnstileToken: 'dev-bypass-token',
      idempotencyKey: crypto.randomUUID(),
    };

    try {
      const res = await fetch('/api/consumer/bookings/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.ok) {
        const errorKey = `errors.${json.error}`;
        setError(
          t.has(errorKey as Parameters<typeof t>[0])
            ? t(errorKey as Parameters<typeof t>[0])
            : t('errors.generic'),
        );
        if (json.errorDetail) setErrorDetail(json.errorDetail as ErrorDetail);
        setSubmitting(false);
        return;
      }
      const ref = encodeURIComponent(json.bookingRef);
      const tok = encodeURIComponent(json.magicLinkToken ?? '');
      const localePath = locale === 'nl' ? '' : `/${locale}`;
      router.push(`${localePath}/r/${config.slug}/book/confirmed?ref=${ref}&t=${tok}`);
    } catch (e) {
      setError(t('errors.generic'));
      setErrorDetail({ stage: 'network', message: e instanceof Error ? e.message : String(e) });
      setSubmitting(false);
    }
  }

  const buttonStyle: React.CSSProperties = submitting
    ? {
        backgroundColor: DISABLED_BG,
        color: DISABLED_TEXT,
        cursor: 'not-allowed',
        border: 'none',
        borderRadius: 6,
        padding: '10px 24px',
        fontSize: 14,
        fontWeight: 500,
        boxShadow: 'none',
        alignSelf: 'flex-end',
        transition: 'background-color 120ms',
      }
    : {
        backgroundColor: isHover ? AMBER_HOVER : AMBER,
        color: WHITE,
        cursor: 'pointer',
        border: 'none',
        borderRadius: 6,
        padding: '10px 24px',
        fontSize: 14,
        fontWeight: 500,
        boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
        alignSelf: 'flex-end',
        transition: 'background-color 120ms',
      };

  return (
    <div className="flex flex-col gap-6">
      <h2 className="font-display text-xl text-night sm:text-2xl">{t('heading')}</h2>

      <div className="flex flex-col gap-4">
        <SummaryRow label={t('summary_when')} value={slotLabel} />
        <SummaryRow label={t('summary_party')} value={String(draft.partySize ?? '')} />
        <SummaryRow label={t('summary_zone')} value={zoneLabel} />
        <SummaryRow label={t('summary_name')} value={draft.guest.name} />
        <SummaryRow label={t('summary_email')} value={draft.guest.email} />
        <SummaryRow label={t('summary_phone')} value={draft.guest.phone} />
        {(draft.guest.allergies || draft.guest.occasion || draft.guest.requests || draft.guest.note) && (
          <SummaryRow
            label={t('summary_notes')}
            value={[
              draft.guest.allergies && `${t('label_allergies')}: ${draft.guest.allergies}`,
              draft.guest.occasion && `${t('label_occasion')}: ${draft.guest.occasion}`,
              draft.guest.requests && `${t('label_requests')}: ${draft.guest.requests}`,
              draft.guest.note && `${t('label_note')}: ${draft.guest.note}`,
            ]
              .filter(Boolean)
              .join('\n')}
            multiline
          />
        )}
      </div>

      <div className="flex flex-col gap-3 border-t border-night/10 pt-4">
        {error && (
          <div className="flex flex-col gap-1">
            <p className="text-sm text-red-700">{error}</p>
            {errorDetail && (
              <pre
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, monospace',
                  fontSize: 11,
                  color: NIGHT,
                  backgroundColor: '#f5efe6',
                  padding: 8,
                  borderRadius: 4,
                  whiteSpace: 'pre-wrap',
                  margin: 0,
                  border: '1px solid #e0d8c8',
                }}
              >
                {JSON.stringify(errorDetail, null, 2)}
              </pre>
            )}
          </div>
        )}
        <button
          type="button"
          onClick={handleConfirm}
          disabled={submitting}
          onMouseEnter={() => setIsHover(true)}
          onMouseLeave={() => setIsHover(false)}
          style={buttonStyle}
        >
          {submitting ? t('confirming') : t('confirm')}
        </button>
        <p className="text-xs text-night/50">{t('terms_disclaimer')}</p>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs uppercase tracking-wider text-night/50">{label}</span>
      <span className={['text-sm text-night', multiline ? 'whitespace-pre-line' : ''].join(' ')}>
        {value}
      </span>
    </div>
  );
}
