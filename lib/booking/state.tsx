// lib/booking/state.tsx
//
// Client-side state machine for the booking flow.
//
// Internal `step` value stays 1..6 (canonical step IDs). Users see a counter
// and dot count derived from `visibleSteps` — the subset of step IDs that
// apply to the current draft (R3/R5 may be skipped). All transitions
// (goNext/goBack/setStep) operate on `visibleSteps`, not raw IDs.

'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { BookingConfig, BookingDraft, GuestDraft } from './types';
import { computeVisibleSteps } from './visibleSteps';

export type { BookingDraft, GuestDraft };

/* -------------------------------------------------------------------------- */
/*  Context shape                                                             */
/* -------------------------------------------------------------------------- */

export interface BookingFlowContextValue {
  step: number;
  visibleSteps: number[];
  currentVisibleIndex: number;
  totalVisibleSteps: number;
  draft: BookingDraft;
  canContinue: boolean;
  setStep: (n: number) => void;
  goNext: () => void;
  goBack: () => void;
  updateDraft: (patch: Partial<BookingDraft>) => void;
  updateGuest: (patch: Partial<GuestDraft>) => void;
  setCanContinue: (v: boolean) => void;
  reset: () => void;
}

const BookingFlowContext = createContext<BookingFlowContextValue | null>(null);

/* -------------------------------------------------------------------------- */
/*  Default draft                                                             */
/* -------------------------------------------------------------------------- */

const EMPTY_DRAFT: BookingDraft = {
  partySize: null,
  date: null,
  slotInstant: null,
  selectedSlotZoneIds: [],
  zoneId: null,
  guest: { name: '', email: '', phone: '', note: '', allergies: '', occasion: '', requests: '' },
  marketingConsent: false,
  depositIntentId: null,
  depositAmountCents: null,
  depositCurrency: null,
};

/* -------------------------------------------------------------------------- */
/*  Provider                                                                  */
/* -------------------------------------------------------------------------- */

export function BookingFlowProvider({
  children,
  config,
}: {
  children: ReactNode;
  config: BookingConfig;
}) {
  const [step, setStepRaw] = useState(1);
  const [draft, setDraft] = useState<BookingDraft>(EMPTY_DRAFT);
  const [canContinue, setCanContinueRaw] = useState(false);

  const visibleSteps = useMemo(
    () => computeVisibleSteps(draft, config),
    [draft, config],
  );

  // Clamp step into visibleSteps if it falls out (e.g. R3 disappears because
  // the user re-picked a 1-zone slot). Snap to the largest visible step <= current.
  useEffect(() => {
    if (visibleSteps.includes(step)) return;
    const fallback =
      [...visibleSteps].reverse().find((s) => s <= step) ?? visibleSteps[0] ?? 1;
    setStepRaw(fallback);
  }, [visibleSteps, step]);

  const currentVisibleIndex = useMemo(() => {
    const idx = visibleSteps.indexOf(step);
    return idx >= 0 ? idx + 1 : 1;
  }, [step, visibleSteps]);

  const totalVisibleSteps = visibleSteps.length;

  const setStep = useCallback(
    (n: number) => {
      if (!Number.isInteger(n)) return;
      if (!visibleSteps.includes(n)) return;
      setStepRaw(n);
      setCanContinueRaw(false);
    },
    [visibleSteps],
  );

  const goNext = useCallback(() => {
    const idx = visibleSteps.indexOf(step);
    if (idx < 0 || idx >= visibleSteps.length - 1) return;
    setStepRaw(visibleSteps[idx + 1]);
    setCanContinueRaw(false);
  }, [step, visibleSteps]);

  const goBack = useCallback(() => {
    const idx = visibleSteps.indexOf(step);
    if (idx <= 0) return;
    setStepRaw(visibleSteps[idx - 1]);
    setCanContinueRaw(false);
  }, [step, visibleSteps]);

  const updateDraft = useCallback((patch: Partial<BookingDraft>) => {
    setDraft((d) => ({ ...d, ...patch }));
  }, []);

  const updateGuest = useCallback((patch: Partial<GuestDraft>) => {
    setDraft((d) => ({ ...d, guest: { ...d.guest, ...patch } }));
  }, []);

  const setCanContinue = useCallback((v: boolean) => {
    setCanContinueRaw(Boolean(v));
  }, []);

  const reset = useCallback(() => {
    setStepRaw(1);
    setDraft(EMPTY_DRAFT);
    setCanContinueRaw(false);
  }, []);

  const value = useMemo<BookingFlowContextValue>(
    () => ({
      step,
      visibleSteps,
      currentVisibleIndex,
      totalVisibleSteps,
      draft,
      canContinue,
      setStep,
      goNext,
      goBack,
      updateDraft,
      updateGuest,
      setCanContinue,
      reset,
    }),
    [
      step,
      visibleSteps,
      currentVisibleIndex,
      totalVisibleSteps,
      draft,
      canContinue,
      setStep,
      goNext,
      goBack,
      updateDraft,
      updateGuest,
      setCanContinue,
      reset,
    ],
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
