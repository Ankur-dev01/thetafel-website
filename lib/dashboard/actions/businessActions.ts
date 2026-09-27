'use client';

// lib/dashboard/actions/businessActions.ts
//
// Client wrapper around the BTW-2 settings/business route. Same
// POST/ok/code shape as hoursActions/bookingRulesActions.

import { useState } from 'react';
import type { BusinessPayload } from '@/lib/dashboard/settings/businessValidation';

export type SaveBusinessResult = { ok: true } | { ok: false; code: string; message?: string };

export function useBusinessActions() {
  const [pending, setPending] = useState(false);

  async function saveBusiness(payload: BusinessPayload): Promise<SaveBusinessResult> {
    setPending(true);
    try {
      const res = await fetch('/api/dashboard/business', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, code: json?.code ?? 'unknown_error', message: json?.message };
      }
      return { ok: true };
    } catch {
      return { ok: false, code: 'network_error' };
    } finally {
      setPending(false);
    }
  }

  return { pending, saveBusiness };
}
