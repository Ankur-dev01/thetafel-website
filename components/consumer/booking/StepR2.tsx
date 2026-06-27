// components/consumer/booking/StepR2.tsx
//
// Slot picker. Fetches the public availability endpoint when (date, partySize)
// is set. If state is incomplete (e.g. refresh on R2 without persisted state),
// redirects back to R1. Selecting a slot writes slotInstant to the draft.

'use client';

import { useCallback, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { AvailabilityResponse, AvailabilityResult, AvailabilitySlot } from '@/lib/booking/types';
import { useBookingFlow } from '@/lib/booking/state';
import { SlotGrid } from './SlotGrid';

interface Props {
  slug: string;
}

type ViewState =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'data'; result: AvailabilityResult };

export function StepR2({ slug }: Props) {
  const t = useTranslations('booking.r2');
  const tShared = useTranslations('booking.shared');
  const locale = useLocale();
  const { draft, updateDraft, setCanContinue, setStep } = useBookingFlow();
  const { date, partySize, slotInstant } = draft;

  const [view, setView] = useState<ViewState>({ kind: 'loading' });
  const [fetchKey, setFetchKey] = useState(0);

  // Bounce back to R1 when R1 state is missing (refresh on R2 without
  // persisted state — step resets to 1 automatically on reload anyway,
  // but this guard handles edge cases in future when we persist step).
  useEffect(() => {
    if (!date || !partySize) setStep(1);
  }, [date, partySize, setStep]);

  // Keep canContinue in sync with draft.slotInstant.
  useEffect(() => {
    setCanContinue(slotInstant != null);
  }, [slotInstant, setCanContinue]);

  // Fetch availability whenever (slug, date, partySize, fetchKey) change.
  useEffect(() => {
    if (!date || !partySize) return;
    const controller = new AbortController();
    setView({ kind: 'loading' });

    const url =
      `/api/v1/public/${encodeURIComponent(slug)}/availability` +
      `?date=${encodeURIComponent(date)}&partySize=${encodeURIComponent(String(partySize))}`;

    fetch(url, { signal: controller.signal, headers: { accept: 'application/json' } })
      .then(async (r) => {
        const json = (await r.json()) as AvailabilityResponse;
        if (!json.ok) {
          setView({ kind: 'error' });
          return;
        }
        setView({ kind: 'data', result: json });
      })
      .catch((e: unknown) => {
        if ((e as { name?: string }).name === 'AbortError') return;
        setView({ kind: 'error' });
      });

    return () => controller.abort();
  }, [slug, date, partySize, fetchKey]);

  const handleSelect = useCallback(
    (slot: AvailabilitySlot) => {
      updateDraft({ slotInstant: slot.instant });
    },
    [updateDraft],
  );

  // "Wijzig / Edit" — clear the slot, go back to R1.
  const handleEdit = useCallback(() => {
    updateDraft({ slotInstant: null });
    setStep(1);
  }, [updateDraft, setStep]);

  const handleRetry = useCallback(() => setFetchKey((k) => k + 1), []);

  if (!date || !partySize) return null;

  const guestsLabel =
    partySize === 1
      ? tShared('guests_one', { count: 1 })
      : tShared('guests_other', { count: partySize });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header summary row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          paddingBottom: 16,
          borderBottom: '1px solid rgba(15, 13, 8, 0.1)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span
            style={{
              fontSize: 14,
              fontFamily: 'var(--font-jost), sans-serif',
              color: 'var(--night, #0f0d08)',
              fontWeight: 500,
            }}
          >
            {formatDateSummary(date, locale)}
          </span>
          <span
            style={{
              fontSize: 12,
              fontFamily: 'var(--font-jost), sans-serif',
              color: 'rgba(15, 13, 8, 0.5)',
            }}
          >
            {guestsLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={handleEdit}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 13,
            fontFamily: 'var(--font-jost), sans-serif',
            color: 'var(--amber, #d4820a)',
            textDecoration: 'underline',
            textUnderlineOffset: 2,
            padding: 0,
            transition: 'opacity 0.15s ease',
          }}
        >
          {t('edit_summary')}
        </button>
      </div>

      {/* Body */}
      {view.kind === 'loading' && <LoadingSkeleton />}
      {view.kind === 'error' && <ErrorState onRetry={handleRetry} />}
      {view.kind === 'data' && (
        <ResultBody
          result={view.result}
          selectedInstant={slotInstant}
          onSelect={handleSelect}
          onChangeDate={handleEdit}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-views                                                                 */
/* -------------------------------------------------------------------------- */

function ResultBody({
  result,
  selectedInstant,
  onSelect,
  onChangeDate,
}: {
  result: AvailabilityResult;
  selectedInstant: string | null;
  onSelect: (slot: AvailabilitySlot) => void;
  onChangeDate: () => void;
}) {
  if (result.partyTooLarge) {
    return (
      <EmptyState
        titleKey="empty_party_too_large_title"
        bodyKey="empty_party_too_large_body"
        onChangeDate={onChangeDate}
        changeDateKey="change_date"
      />
    );
  }
  if (result.closed) {
    return (
      <EmptyState
        titleKey="empty_closed_title"
        bodyKey="empty_closed_body"
        onChangeDate={onChangeDate}
        changeDateKey="change_date"
      />
    );
  }
  if (result.inPast || result.beyondWindow) {
    return (
      <EmptyState
        titleKey="empty_out_of_window_title"
        bodyKey="empty_out_of_window_body"
        onChangeDate={onChangeDate}
        changeDateKey="change_date"
      />
    );
  }
  if (result.slots.length === 0) {
    return (
      <EmptyState
        titleKey="empty_no_slots_title"
        bodyKey="empty_no_slots_body"
        onChangeDate={onChangeDate}
        changeDateKey="change_date"
      />
    );
  }

  return (
    <SlotGrid slots={result.slots} selectedInstant={selectedInstant} onSelect={onSelect} />
  );
}

function LoadingSkeleton() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }} aria-live="polite" aria-busy="true">
      {[0, 1, 2].map((row) => (
        <div key={row} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Section heading placeholder */}
          <div
            style={{
              height: 10,
              width: 64,
              borderRadius: 4,
              background: 'rgba(15, 13, 8, 0.08)',
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
          {/* Slot placeholders */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: 60,
                  borderRadius: 8,
                  background: 'rgba(15, 13, 8, 0.05)',
                  animation: 'pulse 1.5s ease-in-out infinite',
                  animationDelay: `${i * 40}ms`,
                }}
              />
            ))}
          </div>
        </div>
      ))}
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.45}}`}</style>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations('booking.r2');
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 10,
        padding: 20,
        borderRadius: 8,
        background: 'rgba(15, 13, 8, 0.04)',
        border: '1px solid rgba(156, 139, 106, 0.15)',
      }}
    >
      <h3
        style={{
          fontFamily: 'var(--font-raleway), serif',
          fontWeight: 900,
          fontSize: 17,
          color: 'var(--night, #0f0d08)',
          margin: 0,
        }}
      >
        {t('error_title')}
      </h3>
      <p
        style={{
          fontSize: 14,
          fontFamily: 'var(--font-jost), sans-serif',
          color: 'rgba(15, 13, 8, 0.65)',
          margin: 0,
        }}
      >
        {t('error_body')}
      </p>
      <button
        type="button"
        onClick={onRetry}
        style={{
          marginTop: 4,
          padding: '8px 20px',
          background: 'var(--amber, #d4820a)',
          border: 'none',
          borderRadius: 6,
          color: '#fff',
          fontSize: 13,
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'opacity 0.15s ease',
        }}
      >
        {t('retry')}
      </button>
    </div>
  );
}

function EmptyState({
  titleKey,
  bodyKey,
  onChangeDate,
  changeDateKey,
}: {
  titleKey: string;
  bodyKey: string;
  onChangeDate: () => void;
  changeDateKey: string;
}) {
  const t = useTranslations('booking.r2');
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 10,
        padding: 20,
        borderRadius: 8,
        background: 'rgba(15, 13, 8, 0.04)',
        border: '1px solid rgba(156, 139, 106, 0.15)',
      }}
    >
      <h3
        style={{
          fontFamily: 'var(--font-raleway), serif',
          fontWeight: 900,
          fontSize: 17,
          color: 'var(--night, #0f0d08)',
          margin: 0,
        }}
      >
        {t(titleKey)}
      </h3>
      <p
        style={{
          fontSize: 14,
          fontFamily: 'var(--font-jost), sans-serif',
          color: 'rgba(15, 13, 8, 0.65)',
          margin: 0,
        }}
      >
        {t(bodyKey)}
      </p>
      <button
        type="button"
        onClick={onChangeDate}
        style={{
          marginTop: 4,
          padding: '8px 20px',
          background: 'var(--amber, #d4820a)',
          border: 'none',
          borderRadius: 6,
          color: '#fff',
          fontSize: 13,
          fontFamily: 'var(--font-jost), sans-serif',
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'opacity 0.15s ease',
        }}
      >
        {t(changeDateKey)}
      </button>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function formatDateSummary(dateLocal: string, locale: string): string {
  const [y, m, d] = dateLocal.split('-').map(Number);
  const probe = new Date(Date.UTC(y, m - 1, d));
  return new Intl.DateTimeFormat(locale, {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(probe);
}
