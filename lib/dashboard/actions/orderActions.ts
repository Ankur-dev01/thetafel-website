'use client';

// lib/dashboard/actions/orderActions.ts
//
// Client wrapper around the D3.2 advance route + D3.3's cancel/refund
// routes. Mirrors bookingActions.ts's shape (D2.3): POST, never trusts an
// optimistic local update, router.refresh() wrapped in startTransition on
// success so the new status renders once the server-rendered payload
// streams in.
//
// `pending` covers the WHOLE round trip (fetch + refresh), not just the
// refresh tail — `useTransition`'s own pending flag only reflects work done
// inside `startTransition`, i.e. just `router.refresh()`, which would leave
// the button clickable for the entire network request. `submitting` closes
// that gap; the two flags are combined into a single `pending` the caller
// disables on. All three actions (advance/cancel/refund) share this one
// `pending` flag so a pending cancel/refund can't be interrupted by another
// action's click.

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { OrderStatus } from '@/lib/orders/transitionOrderStatus';

export type OrderActionResult = { ok: true } | { ok: false; code: string; message?: string };

export function useOrderActions(orderId: string) {
  const router = useRouter();
  const [refreshPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(path: string, body?: unknown): Promise<OrderActionResult> {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      });
      if (res.ok) {
        startTransition(() => {
          router.refresh();
        });
        return { ok: true };
      }
      const json = await res.json().catch(() => ({ error: 'unknown_error' }));
      const code = json.error ?? 'unknown_error';
      setError(code);
      return { ok: false, code, message: json.message };
    } finally {
      setSubmitting(false);
    }
  }

  async function advance(to: OrderStatus): Promise<OrderActionResult> {
    return post(`/api/dashboard/orders/${orderId}/advance`, { to });
  }

  async function cancel(reason?: string): Promise<OrderActionResult> {
    return post(`/api/dashboard/orders/${orderId}/cancel`, { reason });
  }

  async function refund(reason?: string): Promise<OrderActionResult> {
    return post(`/api/dashboard/orders/${orderId}/refund`, { reason });
  }

  return { advance, cancel, refund, pending: submitting || refreshPending, error };
}
