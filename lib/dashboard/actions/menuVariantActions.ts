'use client';

// lib/dashboard/actions/menuVariantActions.ts
//
// Variant CRUD hits the DB immediately per row, rather than being staged and
// committed with the parent item's Save. Two reasons: adding a variant to an
// existing item shouldn't require re-submitting every item field, and
// immediate writes keep concurrency simple (no diffing a local variant list
// against the server's on save).

import { useTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { VariantPatch, ValidationError } from '@/lib/dashboard/menu/variantValidation';

export type MenuVariantResult =
  | { ok: true; variant?: { id: string; name_nl: string; price_delta_cents: number } }
  | { ok: false; code: string; errors?: ValidationError[] };

export function useMenuVariantActions() {
  const router = useRouter();
  const [refreshPending, startTransition] = useTransition();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function post(path: string, body: unknown): Promise<MenuVariantResult> {
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
        return { ok: true, variant: json.variant };
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
    createVariant: (itemId: string, patch: VariantPatch) =>
      post(`/api/dashboard/menu/items/${itemId}/variants/create`, patch),
    updateVariant: (itemId: string, variantId: string, patch: VariantPatch) =>
      post(`/api/dashboard/menu/items/${itemId}/variants/${variantId}/update`, patch),
    deleteVariant: (itemId: string, variantId: string) =>
      post(`/api/dashboard/menu/items/${itemId}/variants/${variantId}/delete`, {}),
  };
}
