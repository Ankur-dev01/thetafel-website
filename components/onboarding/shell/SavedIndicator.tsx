'use client';

/**
 * SavedIndicator
 *
 * Drops into the StepFrame footer's centre slot. Purely presentational —
 * owns no state. Parent passes the DraftSaveState from useDraftSave().
 *
 *   idle    → renders nothing
 *   saving  → spinner + "Saving…"
 *   saved   → green check + "Saved"
 *   error   → amber "Retry" pill (clicking calls state.retry)
 */

import type { DraftSaveState } from '@/lib/onboarding/useDraftSave';

type SavedIndicatorProps = {
  state: DraftSaveState;
  locale: 'nl' | 'en';
};

export default function SavedIndicator({ state, locale }: SavedIndicatorProps) {
  const labels = {
    nl: { saving: 'Opslaan…', saved: 'Opgeslagen', retry: 'Opnieuw proberen' },
    en: { saving: 'Saving…',  saved: 'Saved',       retry: 'Retry'           },
  }[locale];

  if (state.status === 'idle') return null;

  if (state.status === 'saving') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontSize: '13px',
          fontWeight: 500,
          color: '#9c8b6a',
        }}
        role="status"
        aria-live="polite"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#d4820a"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden="true"
          style={{ animation: 'sind-spin 0.9s linear infinite' }}
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        {labels.saving}
        <style>{`@keyframes sind-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (state.status === 'saved') {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontFamily: 'var(--font-jost), Jost, sans-serif',
          fontSize: '13px',
          fontWeight: 500,
          color: '#3a7d44',
        }}
        role="status"
        aria-live="polite"
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        {labels.saved}
      </div>
    );
  }

  // error state
  return (
    <button
      type="button"
      onClick={state.retry}
      title={state.message}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '6px 12px',
        backgroundColor: 'rgba(212, 130, 10, 0.12)',
        color: '#d4820a',
        border: '1px solid rgba(212, 130, 10, 0.3)',
        borderRadius: '999px',
        fontFamily: 'var(--font-jost), Jost, sans-serif',
        fontSize: '12px',
        fontWeight: 600,
        letterSpacing: '0.05em',
        cursor: 'pointer',
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="23 4 23 10 17 10" />
        <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
      </svg>
      {labels.retry}
    </button>
  );
}
