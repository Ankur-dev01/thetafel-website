'use client';

// lib/dashboard/actions/orderingActions.ts
//
// Client wrapper around the D5.4 settings/ordering route. Same shape as
// bookingRulesActions — no router.refresh(), the editor keeps its own
// baseline state and updates it locally on success.

import { useState } from 'react';
import type { OrderingPayload } from '@/lib/dashboard/settings/orderingValidation';

export type SaveOrderingResult = { ok: true } | { ok: false; code: string; message?: string };

export function useOrderingActions() {
  const [pending, setPending] = useState(false);

  async function saveOrdering(payload: OrderingPayload): Promise<SaveOrderingResult> {
    setPending(true);
    try {
      const res = await fetch('/api/dashboard/settings/ordering', {
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

  return { pending, saveOrdering };
}
