'use client';

// components/consumer/booking/ManageBooking.tsx
//
// The manage-booking UI. Shows the booking summary, and two actions:
//   1. Cancel booking - opens a modal previewing refund amount / policy.
//   2. Request a change - opens a modal with a change-kind picker + message.
//
// Turnstile is mounted on demand only while a modal is open.

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { TurnstileWidget } from './TurnstileWidget';

type BookingSummary = {
  ref: string;
  slotTimeIso: string;
  partySize: number;
  status: string;
  restaurantName: string;
  depositAmountCents: number | null;
  depositCurrency: string | null;
};

type CancellationInfo = {
  cancellable: boolean;
  withinRefundWindow: boolean;
  refundCents: number;
  refundCurrency: string;
  refundDeadlineIso: string | null;
  reason: string;
};

interface Props {
  locale: 'nl' | 'en';
  slug: string;
  token: string;
  booking: BookingSummary;
  cancellation: CancellationInfo;
}

type ChangeKind = 'party_size' | 'time' | 'other';

type ViewState =
  | { kind: 'default' }
  | { kind: 'cancel_modal' }
  | { kind: 'change_modal' }
  | {
      kind: 'cancelled';
      refundStatus: 'not_applicable' | 'refunded' | 'refund_failed';
      refundCents: number;
      refundCurrency: string;
    }
  | { kind: 'change_sent' };

function formatSlot(iso: string, locale: 'nl' | 'en'): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', {
    timeZone: 'Europe/Amsterdam',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function formatMoney(cents: number, currency: string, locale: 'nl' | 'en'): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'nl-NL', {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

export function ManageBooking({ locale, slug, token, booking, cancellation }: Props) {
  const t = useTranslations('booking.manage');
  const tc = useTranslations('booking.cancel');
  const tr = useTranslations('booking.changeRequest');
  const router = useRouter();

  const [view, setView] = useState<ViewState>({ kind: 'default' });
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [cancelTurnstileToken, setCancelTurnstileToken] = useState<string | null>(null);

  const slotStr = formatSlot(booking.slotTimeIso, locale);
  const isAlreadyCancelled = booking.status === 'cancelled';
  const backHref = locale === 'nl' ? `/r/${slug}` : `/${locale}/r/${slug}`;

  async function submitCancel() {
    if (submitting || !cancelTurnstileToken) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/v1/public/${slug}/book/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          token,
          turnstileToken: cancelTurnstileToken,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setSubmitError(tc('errors.generic'));
        setSubmitting(false);
        return;
      }
      setView({
        kind: 'cancelled',
        refundStatus: data.refundStatus ?? 'not_applicable',
        refundCents: data.refundCents ?? 0,
        refundCurrency: data.refundCurrency ?? booking.depositCurrency ?? 'EUR',
      });
      setSubmitting(false);
      router.refresh();
    } catch {
      setSubmitError(tc('errors.generic'));
      setSubmitting(false);
    }
  }

  async function submitChangeRequest(kind: ChangeKind, message: string, turnstileToken: string) {
    if (submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/v1/public/${slug}/book/change-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          token,
          turnstileToken,
          changeKind: kind,
          message,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.ok) {
        setSubmitError(tr('errors.generic'));
        setSubmitting(false);
        return;
      }
      setView({ kind: 'change_sent' });
      setSubmitting(false);
    } catch {
      setSubmitError(tr('errors.generic'));
      setSubmitting(false);
    }
  }

  // ── Completed states ─────────────────────────────────────────────────────

  if (view.kind === 'cancelled') {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-16 text-center">
        <h1 className="font-display text-[clamp(24px,4vw,32px)] font-black text-night">
          {tc('success_heading')}
        </h1>
        {view.refundStatus === 'refunded' && view.refundCents > 0 ? (
          <p className="font-body text-[15px] leading-relaxed text-night/70">
            {tc('success_body_refunded', {
              amount: formatMoney(view.refundCents, view.refundCurrency, locale),
            })}
          </p>
        ) : view.refundStatus === 'refund_failed' ? (
          <p className="font-body text-[15px] leading-relaxed text-night/70">
            {tc('success_body_refund_failed')}
          </p>
        ) : (
          <p className="font-body text-[15px] leading-relaxed text-night/70">
            {tc('success_body_no_deposit')}
          </p>
        )}
        <Link href={backHref} className="font-body text-[15px] font-medium text-amber underline">
          {tc('back_to_restaurant')}
        </Link>
      </div>
    );
  }

  if (view.kind === 'change_sent') {
    return (
      <div className="mx-auto flex max-w-xl flex-col gap-6 px-6 py-16 text-center">
        <h1 className="font-display text-[clamp(24px,4vw,32px)] font-black text-night">
          {tr('success_heading')}
        </h1>
        <p className="font-body text-[15px] leading-relaxed text-night/70">{tr('success_body')}</p>
        <Link href={backHref} className="font-body text-[15px] font-medium text-amber underline">
          {tr('back_button')}
        </Link>
      </div>
    );
  }

  // ── Default view ─────────────────────────────────────────────────────────

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-8 px-6 py-12 sm:py-16">
      <div>
        <p className="font-body text-xs font-medium uppercase tracking-wider text-night/55">
          {t('title_eyebrow')}
        </p>
        <h1 className="font-display text-[clamp(28px,5vw,40px)] font-black leading-tight text-night">
          {booking.restaurantName}
        </h1>
      </div>

      {isAlreadyCancelled && (
        <div className="rounded-card bg-amber-light px-[18px] py-[14px] font-body text-sm text-night">
          {t('already_cancelled_banner')}
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-card bg-warm p-6">
        <SummaryRow label={t('ref_label')} value={booking.ref} />
        <SummaryRow label={t('when_label')} value={slotStr} />
        <SummaryRow
          label={t('party_label')}
          value={
            locale === 'nl' ? `${booking.partySize} personen` : `${booking.partySize} guests`
          }
        />
      </div>

      {!isAlreadyCancelled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'stretch' }}>
          <button
            type="button"
            onClick={() => setView({ kind: 'change_modal' })}
            style={{
              fontFamily: 'var(--font-jost), sans-serif',
              fontSize: 15,
              fontWeight: 500,
              color: '#fdfaf5',
              backgroundColor: '#d4820a',
              padding: '16px 24px',
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            {t('change_button')}
          </button>
          {cancellation.cancellable && (
            <button
              type="button"
              onClick={() => setView({ kind: 'cancel_modal' })}
              style={{
                fontFamily: 'var(--font-jost), sans-serif',
                fontSize: 14,
                fontWeight: 400,
                color: 'rgba(15, 13, 8, 0.6)',
                backgroundColor: 'transparent',
                padding: '8px 20px',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'underline',
                textAlign: 'center',
                alignSelf: 'center',
              }}
            >
              {t('cancel_button')}
            </button>
          )}
        </div>
      )}

      {view.kind === 'cancel_modal' && (
        <Modal onClose={() => setView({ kind: 'default' })}>
          <h2 className="font-display text-xl font-black text-night">{tc('modal_heading')}</h2>

          {cancellation.reason === 'cancellable_full_refund' && (
            <p className="font-body text-[15px] leading-relaxed text-night/80">
              {tc('modal_body_refund', {
                amount: formatMoney(cancellation.refundCents, cancellation.refundCurrency, locale),
                deadline: cancellation.refundDeadlineIso
                  ? formatSlot(cancellation.refundDeadlineIso, locale)
                  : '',
              })}
            </p>
          )}
          {cancellation.reason === 'cancellable_no_refund_past_deadline' && (
            <p className="font-body text-[15px] leading-relaxed text-night/80">
              {tc('modal_body_no_refund')}
            </p>
          )}
          {cancellation.reason === 'cancellable_no_deposit' && (
            <p className="font-body text-[15px] leading-relaxed text-night/80">
              {tc('modal_body_no_deposit')}
            </p>
          )}

          <TurnstileWidget onSuccess={setCancelTurnstileToken} onError={() => setCancelTurnstileToken(null)} />

          {submitError && <p className="font-body text-sm text-red-700">{submitError}</p>}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => setView({ kind: 'default' })}
              className="flex-1 rounded-pill border border-night/15 px-5 py-[12px] font-body text-sm font-medium text-night"
            >
              {tc('keep_button')}
            </button>
            <button
              type="button"
              onClick={submitCancel}
              disabled={submitting || !cancelTurnstileToken}
              className="flex-1 rounded-pill bg-night px-5 py-[12px] font-body text-sm font-medium text-cream disabled:opacity-50"
            >
              {submitting ? tc('confirming') : tc('confirm_button')}
            </button>
          </div>
        </Modal>
      )}

      {view.kind === 'change_modal' && (
        <ChangeRequestModal
          onClose={() => setView({ kind: 'default' })}
          onSubmit={submitChangeRequest}
          submitting={submitting}
          submitError={submitError}
        />
      )}
    </div>
  );
}

function ChangeRequestModal({
  onClose,
  onSubmit,
  submitting,
  submitError,
}: {
  onClose: () => void;
  onSubmit: (kind: ChangeKind, message: string, turnstileToken: string) => void;
  submitting: boolean;
  submitError: string | null;
}) {
  const tr = useTranslations('booking.changeRequest');
  const [kind, setKind] = useState<ChangeKind>('party_size');
  const [message, setMessage] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const canSubmit = message.trim().length >= 3 && !!turnstileToken && !submitting;

  const kinds: ChangeKind[] = ['party_size', 'time', 'other'];

  return (
    <Modal onClose={onClose}>
      <h2 className="font-display text-xl font-black text-night">{tr('modal_heading')}</h2>

      <div className="flex flex-col gap-2">
        <span className="font-body text-xs font-medium uppercase tracking-wide text-night/55">
          {tr('kind_label')}
        </span>
        <div className="flex flex-wrap gap-2">
          {kinds.map((k) => {
            const selected = kind === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                disabled={submitting}
                style={{
                  padding: '10px 16px',
                  fontFamily: 'var(--font-jost), sans-serif',
                  fontSize: 14,
                  fontWeight: 500,
                  backgroundColor: selected ? '#0f0d08' : 'transparent',
                  color: selected ? '#fdfaf5' : '#0f0d08',
                  border: selected ? '1px solid #0f0d08' : '1px solid rgba(15, 13, 8, 0.2)',
                  borderRadius: 999,
                  cursor: submitting ? 'not-allowed' : 'pointer',
                  transition: 'background-color 120ms, color 120ms, border-color 120ms',
                }}
              >
                {tr(`kind_${k}`)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label
          htmlFor="change-message"
          className="font-body text-xs font-medium uppercase tracking-wide text-night/55"
        >
          {tr('message_label')}
        </label>
        <textarea
          id="change-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={tr('message_placeholder')}
          maxLength={500}
          rows={4}
          disabled={submitting}
          className="rounded-card border border-night/15 bg-cream p-3 font-body text-sm text-night"
        />
      </div>

      <TurnstileWidget onSuccess={setTurnstileToken} onError={() => setTurnstileToken(null)} />

      {submitError && <p className="font-body text-sm text-red-700">{submitError}</p>}

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="flex-1 rounded-pill border border-night/15 px-5 py-3 font-body text-sm font-medium text-night"
        >
          {tr('cancel_button')}
        </button>
        <button
          type="button"
          onClick={() => turnstileToken && onSubmit(kind, message.trim(), turnstileToken)}
          disabled={!canSubmit}
          className="flex-1 rounded-pill bg-night px-5 py-3 font-body text-sm font-medium text-cream disabled:opacity-50"
        >
          {submitting ? tr('submitting') : tr('submit_button')}
        </button>
      </div>
    </Modal>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-body text-[11px] font-medium uppercase tracking-wide text-night/55">
        {label}
      </span>
      <span className="font-body text-base font-medium leading-relaxed text-night">{value}</span>
    </div>
  );
}

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 13, 8, 0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: '#fdfaf5',
          borderRadius: 20,
          padding: 32,
          maxWidth: 480,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 60px rgba(15, 13, 8, 0.3)',
        }}
      >
        <div className="flex flex-col gap-4">{children}</div>
      </div>
    </div>
  );
}
