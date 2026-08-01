'use client';

// lib/dashboard/actions/tabActions.ts
//
// Client wrapper around D3.4's tab close route. Same shape as
// orderActions.ts: POST, never trusts an optimistic local update,
// router.refresh() wrapped in startTransition on success. `pending` covers
// the whole fetch+refresh round trip and is shared across both actions so a
// pending settle/write-off can't be interrupted by the other.

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';

export type TabActionResult = { ok: true } | { ok: false; code: string; message?: string };

export function useTabActions(tabId: string) {
  const router = useRouter();
  const [refreshPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(body: unknown): Promise<TabActionResult> {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/dashboard/tabs/${tabId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  async function closeTabPaidAtTable(): Promise<TabActionResult> {
    return post({ settlement: 'paid_at_table' });
  }

  async function writeOffTab(reason: string): Promise<TabActionResult> {
    return post({ settlement: 'written_off', reason });
  }

  return { closeTabPaidAtTable, writeOffTab, pending: submitting || refreshPending, error };
}
