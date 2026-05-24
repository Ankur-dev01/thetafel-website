// lib/restaurants/draft.ts
//
// Client-side helper that auto-saves a single onboarding field to the
// authenticated user's restaurant draft. Called from each step page's
// onBlur handler — owner can close the tab mid-onboarding and resume
// on the same step with all entered data intact.
//
// Per Phase 1 PRD §C.1: "Called on each field's onBlur event. Enables
// auto-save."
//
// Design notes:
//
//   - The PRD signature is saveDraft(field, value, restaurantId). We omit
//     restaurantId. The server route resolves the restaurant from the
//     session (user_id = auth.uid() under RLS), so the client doesn't
//     need to know it. This also closes a tampering hole — a client
//     can't try to write a different restaurant's row.
//
//   - Returns a tagged result rather than throwing. Step pages decorate
//     the field with an inline error on { ok: false } without needing
//     try/catch around every blur.
//
//   - The companion API route /api/v1/restaurants/draft is created in
//     Phase C.2 (after the additive KVK migration). Calling saveDraft
//     before that route exists will return { ok: false } — which is the
//     correct behaviour for C.1 verification (no step page wires it up
//     yet, the placeholder Step 1 just smoke-tests the layout).

export type SaveDraftResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string }

/**
 * PUT a single field update to the authenticated user's restaurant draft.
 *
 * @param field  Column name on the restaurants table. The server route
 *               whitelists which fields are writable from the client —
 *               this client helper does no validation of its own.
 * @param value  Any JSON-serialisable value. The server validates the
 *               type per field.
 */
export async function saveDraft<T = unknown>(
  field: string,
  value: unknown
): Promise<SaveDraftResult<T>> {
  try {
    const res = await fetch('/api/v1/restaurants/draft', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, value }),
      // Onboarding draft writes are never cacheable.
      cache: 'no-store',
    })

    if (!res.ok) {
      // Try to surface a server-provided error message; fall back to status.
      let serverMessage = ''
      try {
        const body = await res.json()
        if (body && typeof body.error === 'string') {
          serverMessage = body.error
        }
      } catch {
        // body wasn't JSON; ignore
      }
      return {
        ok: false,
        status: res.status,
        error: serverMessage || `Request failed (${res.status})`,
      }
    }

    const data = (await res.json()) as T
    return { ok: true, data }
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Network error'
    return { ok: false, status: 0, error: message }
  }
}
