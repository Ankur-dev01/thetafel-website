'use client';

// lib/dashboard/actions/bookingActions.ts
//
// Client wrappers around the D2.3 booking-action routes. Every call POSTs,
// never trusts an optimistic local update, and on success refreshes the
// server-rendered payload via router.refresh() wrapped in startTransition so
// the dashboard doesn't blank while the new data streams in.
//
// Two router imports on purpose: next/navigation's useRouter is used only
// for refresh() (a data-refetch primitive, not a navigation), while
// @/i18n/routing's is reserved for actual locale-aware navigation elsewhere
// in this component tree — same split already established in D2.1/D2.2.

import { useTransition } from 'react';
import { useRouter as useNextRouter } from 'next/navigation';
import type { BookingEditPatch } from '@/lib/dashboard/bookings/types';

export type BookingActionResult = { ok: true } | { ok: false; code: string; message?: string };

async function post(path: string, body?: unknown): Promise<BookingActionResult> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.ok) return { ok: true };
  const json = await res.json().catch(() => ({ error: 'unknown_error' }));
  return { ok: false, code: json.error ?? 'unknown_error', message: json.message };
}

export function useBookingActions(bookingId: string) {
  const nextRouter = useNextRouter();
  const [pending, startTransition] = useTransition();

  function refreshAfter(result: BookingActionResult): BookingActionResult {
    if (result.ok) {
      startTransition(() => {
        nextRouter.refresh();
      });
    }
    return result;
  }

  return {
    pending,
    attend: async () => refreshAfter(await post(`/api/dashboard/bookings/${bookingId}/attend`)),
    noShow: async () => refreshAfter(await post(`/api/dashboard/bookings/${bookingId}/no-show`)),
    cancel: async (reason?: string) =>
      refreshAfter(await post(`/api/dashboard/bookings/${bookingId}/cancel`, { reason })),
    edit: async (patch: BookingEditPatch) =>
      refreshAfter(await post(`/api/dashboard/bookings/${bookingId}/edit`, patch)),
  };
}
