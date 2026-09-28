'use client';

// lib/dashboard/actions/notificationsActions.ts
//
// Client wrapper around the D5.6a settings/notifications route. Same
// POST/ok/code shape as businessActions.

import { useState } from 'react';

export type NotificationsPayload = {
  notify_booking_confirmed: boolean;
  notify_booking_cancelled: boolean;
  notify_order_confirmed: boolean;
  notify_order_ready: boolean;
  notify_restaurant_new_booking: boolean;
  notify_restaurant_new_order: boolean;
  notify_restaurant_booking_cancelled: boolean;
};

export type SaveNotificationsResult = { ok: true } | { ok: false; code: string; message?: string };

export function useNotificationsActions() {
  const [pending, setPending] = useState(false);

  async function saveNotifications(payload: NotificationsPayload): Promise<SaveNotificationsResult> {
    setPending(true);
    try {
      const res = await fetch('/api/dashboard/notifications', {
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

  return { pending, saveNotifications };
}
