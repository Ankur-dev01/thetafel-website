'use client';

// lib/dashboard/actions/bookingRulesActions.ts
//
// Client wrapper around the D5.3 settings/booking route. Same shape as
// hoursActions/floorPlanActions — no router.refresh(), the editor keeps its
// own baseline state and updates it locally on success.

import { useState } from 'react';
import type { BookingRulesPayload } from '@/lib/dashboard/settings/bookingRulesValidation';

export type SaveBookingRulesResult = { ok: true } | { ok: false; code: string; message?: string; token?: string };

export function useBookingRulesActions() {
  const [pending, setPending] = useState(false);

  async function saveBookingRules(payload: BookingRulesPayload): Promise<SaveBookingRulesResult> {
    setPending(true);
    try {
      const res = await fetch('/api/dashboard/settings/booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, code: json?.code ?? 'unknown_error', message: json?.message, token: json?.token };
      }
      return { ok: true };
    } catch {
      return { ok: false, code: 'network_error' };
    } finally {
      setPending(false);
    }
  }

  return { pending, saveBookingRules };
}
