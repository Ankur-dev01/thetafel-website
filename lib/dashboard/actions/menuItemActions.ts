'use client';

// lib/dashboard/actions/menuItemActions.ts
//
// Client wrappers around the D4.3 item routes. Same shape as
// menuCategoryActions: POST, never optimistic about the server's answer,
// router.refresh() inside startTransition on success, one `pending` covering
// fetch + refresh so a button can't be re-clicked mid-round-trip.

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ItemPatch, ValidationError } from '@/lib/dashboard/menu/itemValidation';

export type MenuItemResult =
  | { ok: true; changed?: boolean }
  | { ok: false; code: string; errors?: ValidationError[] };

export function useMenuItemActions() {
  const router = useRouter();
  const [refreshPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(path: string, body: unknown): Promise<MenuItemResult> {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({ error: 'unknown_error' }));
      if (res.ok) {
        startTransition(() => {
          router.refresh();
        });
        return { ok: true, changed: json.changed };
      }
      const code = json.error ?? 'unknown_error';
      setError(code);
      return { ok: false, code, errors: json.errors };
    } finally {
      setSubmitting(false);
    }
  }

  return {
    pending: submitting || refreshPending,
    error,
    createItem: (patch: ItemPatch) => post('/api/dashboard/menu/items/create', patch),
    updateItem: (id: string, patch: ItemPatch) => post(`/api/dashboard/menu/items/${id}/update`, patch),
    deleteItem: (id: string) => post(`/api/dashboard/menu/items/${id}/delete`, {}),
    toggle86: (id: string, available: boolean) =>
      post(`/api/dashboard/menu/items/${id}/toggle-86`, { available }),
    toggleVisibility: (id: string, changes: { visible_takeaway?: boolean; visible_qr?: boolean }) =>
      post(`/api/dashboard/menu/items/${id}/toggle-visibility`, changes),
    reorderItems: (categoryId: string, orderedIds: string[]) =>
      post('/api/dashboard/menu/items/reorder', { category_id: categoryId, ordered_ids: orderedIds }),
  };
}
