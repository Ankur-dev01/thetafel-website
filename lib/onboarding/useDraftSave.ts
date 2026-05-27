'use client';

/**
 * useDraftSave
 *
 * Debounced PATCH-to-/api/v1/restaurants/draft lifecycle hook.
 *
 *   save(patch)    — merges into pending patch, debounces 800 ms, then PATCHes.
 *   saveNow(patch) — merges, cancels debounce, PATCHes immediately.
 *
 * Retries failed PATCHes with exponential backoff (1s, 2s, 4s). After 3
 * failures surfaces an 'error' state with a retry callback.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

// ---- Types ---------------------------------------------------------------

type DraftRestaurantPatch = Record<string, unknown>;

export type DraftPatch = {
  restaurant?: DraftRestaurantPatch;
  zones?: unknown[];
  tables?: unknown[];
  availability?: unknown[];
  menu_uploads?: unknown[];
};

export type DraftSaveState =
  | { status: 'idle' }
  | { status: 'saving' }
  | { status: 'saved' }
  | { status: 'error'; message: string; retry: () => void };

const DEBOUNCE_MS = 800;
const RETRY_DELAYS_MS = [1000, 2000, 4000];

// ---- Helpers -------------------------------------------------------------

function mergePatch(base: DraftPatch, incoming: DraftPatch): DraftPatch {
  const out: DraftPatch = { ...base };
  if (incoming.restaurant) {
    out.restaurant = { ...(base.restaurant ?? {}), ...incoming.restaurant };
  }
  if (incoming.zones) out.zones = incoming.zones;
  if (incoming.tables) out.tables = incoming.tables;
  if (incoming.availability) out.availability = incoming.availability;
  if (incoming.menu_uploads) out.menu_uploads = incoming.menu_uploads;
  return out;
}

function isEmpty(patch: DraftPatch): boolean {
  return (
    !patch.restaurant &&
    !patch.zones &&
    !patch.tables &&
    !patch.availability &&
    !patch.menu_uploads
  );
}

async function patchDraft(patch: DraftPatch): Promise<unknown> {
  const res = await fetch('/api/v1/restaurants/draft', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
    cache: 'no-store',
  });
  if (!res.ok) {
    let message = `Save failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string; message?: string };
      message = body.message ?? body.error ?? message;
    } catch {
      /* not JSON */
    }
    throw new Error(message);
  }
  return res.json();
}

// ---- Hook ----------------------------------------------------------------

export function useDraftSave() {
  const [state, setState] = useState<DraftSaveState>({ status: 'idle' });

  const pendingPatchRef = useRef<DraftPatch>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedClearRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Flush (the actual PATCH) ----------------------------------------

  const flushInternal = useCallback(async (): Promise<unknown> => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    if (isEmpty(pendingPatchRef.current)) return null;

    const patchToSend = pendingPatchRef.current;
    pendingPatchRef.current = {};
    setState({ status: 'saving' });

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
      try {
        const result = await patchDraft(patchToSend);
        setState({ status: 'saved' });
        if (savedClearRef.current) clearTimeout(savedClearRef.current);
        savedClearRef.current = setTimeout(() => {
          setState((s) => (s.status === 'saved' ? { status: 'idle' } : s));
        }, 2000);
        return result;
      } catch (e) {
        lastError = e instanceof Error ? e : new Error('Save failed');
        if (attempt < RETRY_DELAYS_MS.length) {
          await new Promise((r) => setTimeout(r, RETRY_DELAYS_MS[attempt]));
        }
      }
    }

    // All retries exhausted — re-stage patch so a manual retry can pick it up.
    pendingPatchRef.current = mergePatch(pendingPatchRef.current, patchToSend);
    const message = lastError?.message ?? 'Save failed';
    setState({
      status: 'error',
      message,
      retry: () => { void flushInternal(); },
    });
    throw lastError;
  }, []);

  // ---- Debounced save --------------------------------------------------

  const save = useCallback(
    (patch: DraftPatch) => {
      pendingPatchRef.current = mergePatch(pendingPatchRef.current, patch);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => { void flushInternal(); }, DEBOUNCE_MS);
      // Show "saving" immediately so the indicator appears without waiting.
      setState((prev) => (prev.status === 'error' ? prev : { status: 'saving' }));
    },
    [flushInternal]
  );

  // ---- Immediate save (used by Continue) ------------------------------

  const saveNow = useCallback(
    async (patch?: DraftPatch): Promise<unknown> => {
      if (patch) {
        pendingPatchRef.current = mergePatch(pendingPatchRef.current, patch);
      }
      return flushInternal();
    },
    [flushInternal]
  );

  // ---- Cleanup ---------------------------------------------------------

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (savedClearRef.current) clearTimeout(savedClearRef.current);
    };
  }, []);

  return { state, save, saveNow };
}
