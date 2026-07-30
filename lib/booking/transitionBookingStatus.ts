// lib/booking/transitionBookingStatus.ts
//
// Shared monotonic-transition core, extracted from the pattern already used
// by app/api/v1/public/[slug]/book/cancel/route.ts. No dedicated helper
// existed before D2.3 — every call site rolled its own
// `.update({...}).eq('id', id).eq('status', from)` inline. This is that
// pattern, factored out so dashboard routes don't duplicate it a third time.
//
// The `.eq('status', from)` clause IS the monotonic guard: if the row's
// status has already moved on (concurrent request, stale client), the UPDATE
// matches zero rows and `transitioned` comes back false — no error, no
// side effect, safe to treat as "someone else already did this."

import 'server-only';
import type { createSupabaseServerClientAdmin } from '@/lib/supabase/server';

type SupabaseAdminClient = Awaited<ReturnType<typeof createSupabaseServerClientAdmin>>;

export type TransitionedBooking = {
  id: string;
  status: string;
  slot_time: string;
  updated_at: string;
};

export type TransitionBookingStatusResult =
  | { ok: true; transitioned: true; booking: TransitionedBooking }
  | { ok: true; transitioned: false }
  | { ok: false; error: string };

/**
 * Transition a booking from one status to another, guarded by the current
 * status so a concurrent/duplicate call is a no-op rather than a double
 * side-effect. `fields` are additional columns written in the same UPDATE
 * (e.g. `attended_at`, `cancelled_by`) — never a second statement, so the
 * write is atomic with the status change.
 */
export async function transitionBookingStatus(
  supabase: SupabaseAdminClient,
  bookingId: string,
  restaurantId: string,
  from: string,
  to: string,
  fields: Record<string, unknown> = {},
): Promise<TransitionBookingStatusResult> {
  const { data, error } = await supabase
    .from('bookings')
    .update({ status: to, ...fields })
    .eq('id', bookingId)
    .eq('restaurant_id', restaurantId)
    .eq('status', from)
    .select('id, status, slot_time, updated_at')
    .maybeSingle();

  if (error) {
    return { ok: false, error: error.message };
  }
  if (data === null) {
    return { ok: true, transitioned: false };
  }
  return { ok: true, transitioned: true, booking: data as TransitionedBooking };
}
