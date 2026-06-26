// lib/booking/state.ts
//
// Client-side state machine for the booking flow.
//
// Why React Context (not Zustand):
//   - Only one consumer tree (the booking shell).
//   - State is short-lived (resets on full page refresh — acceptable for v1;
//     persistence to URL or localStorage is a future enhancement).
//   - Zustand adds a dependency for marginal benefit on this tree size.
//
// Step numbering matches PRD §4: R1=1 (date+party), R2=2 (slot), R3=3 (zone, optional),
// R4=4 (guest details), R5=5 (deposit, optional), R6=6 (review). Skipping R3/R5
// is handled by `visibleSteps` in a later unit; the raw step counter here is the
// canonical 1..6 index regardless of visibility.

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

/* -------------------------------------------------------------------------- */
/*  Types                                                                     */
/* -------------------------------------------------------------------------- */

export interface GuestDraft {
  name: string;
  email: string;
  phone: string;
  note: string;
}

export interface BookingDraft {
  /** R1 */
  partySize: number | null;
  /** R1 — YYYY-MM-DD in Europe/Amsterdam. */
  date: string | null;
  /** R2 — UTC ISO instant of the chosen slot. */
  slotInstant: string | null;
  /** R3 — chosen zone id (optional; null when restaurant has 1 zone or guest skipped). */
  zoneId: string | null;
  /** R4 */
  guest: GuestDraft;
  /** R4 — marketing consent checkbox. */
  marketingConsent: boolean;
}

const EMPTY_DRAFT: BookingDraft = {
  partySize: null,
  date: null,
  slotInstant: null,
  zoneId: null,
  guest: { name: '', email: '', phone: '', note: '' },
  marketingConsent: false,
};

export interface BookingFlowContextValue {
  step: number;
  totalSteps: number;
  draft: BookingDraft;
  setStep: (n: number) => void;
  goNext: () => void;
  goBack: () => void;
  updateDraft: (patch: Partial<BookingDraft>) => void;
  updateGuest: (patch: Partial<GuestDraft>) => void;
  reset: () => void;
}

const BookingFlowContext = createContext<BookingFlowContextValue | null>(null);

/* -------------------------------------------------------------------------- */
/*  Provider                                                                  */
/* -------------------------------------------------------------------------- */

export function BookingFlowProvider({
  children,
  totalSteps = 6,
}: {
  children: ReactNode;
  totalSteps?: number;
}) {
  const [step, setStepRaw] = useState(1);
  const [draft, setDraft] = useState<BookingDraft>(EMPTY_DRAFT);

  const setStep = useCallback(
    (n: number) => {
      if (!Number.isInteger(n)) return;
      const clamped = Math.max(1, Math.min(totalSteps, n));
      setStepRaw(clamped);
    },
    [totalSteps],
  );

  const goNext = useCallback(() => {
    setStepRaw((s) => Math.min(totalSteps, s + 1));
  }, [totalSteps]);

  const goBack = useCallback(() => {
    setStepRaw((s) => Math.max(1, s - 1));
  }, []);

  const updateDraft = useCallback((patch: Partial<BookingDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
  }, []);

  const updateGuest = useCallback((patch: Partial<GuestDraft>) => {
    setDraft((d) => ({ ...d, guest: { ...d.guest, ...patch } }));
  }, []);

  const reset = useCallback(() => {
    setStepRaw(1);
    setDraft(EMPTY_DRAFT);
  }, []);

  const value = useMemo<BookingFlowContextValue>(
    () => ({
      step,
      totalSteps,
      draft,
      setStep,
      goNext,
      goBack,
      updateDraft,
      updateGuest,
      reset,
    }),
    [step, totalSteps, draft, setStep, goNext, goBack, updateDraft, updateGuest, reset],
  );

  return <BookingFlowContext.Provider value={value}>{children}</BookingFlowContext.Provider>;
}

export function useBookingFlow(): BookingFlowContextValue {
  const ctx = useContext(BookingFlowContext);
  if (!ctx) {
    throw new Error('useBookingFlow must be used inside BookingFlowProvider');
  }
  return ctx;
}
