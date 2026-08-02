'use client';

// lib/dashboard/actions/menuCategoryActions.ts
//
// Client wrappers around the D4.2 menu-category routes. Same shape as
// orderActions/tabActions: POST, never optimistic about the server's answer,
// router.refresh() inside startTransition on success, and a single `pending`
// covering fetch + refresh together so a button can't be re-clicked mid-round-trip.
//
// Unlike the order/tab wrappers these also surface `errors` — the create and
// update routes return field-level validation failures the dialog renders
// inline under the offending input.

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { CategoryPatch, ValidationError } from '@/lib/dashboard/menu/categoryValidation';

export type MenuCategoryResult =
  | { ok: true }
  | { ok: false; code: string; errors?: ValidationError[]; itemCount?: number };

export function useMenuCategoryActions() {
  const router = useRouter();
  const [refreshPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);

  async function post(path: string, body: unknown): Promise<MenuCategoryResult> {
    setSubmitting(true);
    try {
      const res = await fetch(path, {
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
      return {
        ok: false,
        code: json.error ?? 'unknown_error',
        errors: json.errors,
        itemCount: json.item_count,
      };
    } finally {
      setSubmitting(false);
    }
  }

  return {
    pending: submitting || refreshPending,
    createCategory: (patch: CategoryPatch) => post('/api/dashboard/menu/categories/create', patch),
    updateCategory: (id: string, patch: CategoryPatch) =>
      post(`/api/dashboard/menu/categories/${id}/update`, patch),
    deleteCategory: (id: string) => post(`/api/dashboard/menu/categories/${id}/delete`, {}),
    reorderCategories: (orderedIds: string[]) =>
      post('/api/dashboard/menu/categories/reorder', { ordered_ids: orderedIds }),
  };
}
