'use client';

// lib/dashboard/actions/qrSettingsActions.ts
//
// Client wrapper around the D5.5 settings/qr route. Same shape as
// bookingRulesActions/orderingActions — no router.refresh(), the editor
// keeps its own baseline state and updates it locally on success.

import { useState } from 'react';
import type { QrSettingsPayload } from '@/lib/dashboard/settings/qrSettingsValidation';

export type SaveQrSettingsResult = { ok: true } | { ok: false; code: string; message?: string };

export function useQrSettingsActions() {
  const [pending, setPending] = useState(false);

  async function saveQrSettings(payload: QrSettingsPayload): Promise<SaveQrSettingsResult> {
    setPending(true);
    try {
      const res = await fetch('/api/dashboard/settings/qr', {
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

  return { pending, saveQrSettings };
}
