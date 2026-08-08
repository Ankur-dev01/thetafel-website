'use client';

// lib/dashboard/actions/hoursActions.ts
//
// Client wrapper around the D5.1 settings/hours route. Same POST/ok/errors
// shape as menuCategoryActions, minus router.refresh() — the hours editor
// keeps its own baseline state and updates it locally on success rather than
// reloading, per the D5.1 spec ("no page reload").

import { useState } from 'react';
import type { HoursSavePayload, ValidationError } from '@/lib/dashboard/settings/hoursValidation';

export type SaveHoursResult = { ok: true } | { ok: false; code: string; errors?: ValidationError[] };

export function useHoursActions() {
  const [pending, setPending] = useState(false);

  async function saveHours(payload: HoursSavePayload): Promise<SaveHoursResult> {
    setPending(true);
    try {
      const res = await fetch('/api/dashboard/settings/hours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { ok: false, code: json?.error ?? 'unknown_error', errors: json?.errors };
      }
      return { ok: true };
    } catch {
      return { ok: false, code: 'network_error' };
    } finally {
      setPending(false);
    }
  }

  return { pending, saveHours };
}
