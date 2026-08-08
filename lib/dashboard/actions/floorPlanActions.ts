'use client';

// lib/dashboard/actions/floorPlanActions.ts
//
// Client wrapper around the D5.2 settings/floor route. Same shape as
// hoursActions — no router.refresh(), the editor keeps its own baseline
// state and merges the server's returned new-table ids locally on success.

import { useState } from 'react';
import type { FloorSavePayload, ValidationError } from '@/lib/dashboard/settings/floorPlanValidation';

export type SaveFloorPlanResult =
  | { ok: true; addedIds: string[] }
  | { ok: false; code: string; errors?: ValidationError[]; blockedTableNames?: string[] };

export function useFloorPlanActions() {
  const [pending, setPending] = useState(false);

  async function saveFloorPlan(payload: FloorSavePayload): Promise<SaveFloorPlanResult> {
    setPending(true);
    try {
      const res = await fetch('/api/dashboard/settings/floor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          ok: false,
          code: json?.error ?? 'unknown_error',
          errors: json?.errors,
          blockedTableNames: json?.blockedTableNames,
        };
      }
      return { ok: true, addedIds: json?.ids?.added ?? [] };
    } catch {
      return { ok: false, code: 'network_error' };
    } finally {
      setPending(false);
    }
  }

  return { pending, saveFloorPlan };
}
