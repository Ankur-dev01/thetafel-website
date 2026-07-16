import 'server-only'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'

/**
 * GDPR erasure (C8.2) — thin caller for the `anonymise_guest` Postgres
 * function (migration 017), which performs the entire anonymisation
 * atomically. See that migration for exactly what gets scrubbed.
 */

export type AnonymiseGuestResult =
  | { ok: true; originalEmail: string }
  | { ok: false; reason: 'upcoming_booking' | 'active_order' | 'payment_in_flight' | 'guest_not_found' }
  | { ok: false; reason: 'failed' }

export async function anonymiseGuest(guestId: string): Promise<AnonymiseGuestResult> {
  try {
    const admin = await createSupabaseServerClientAdmin()
    const { data, error } = await admin.rpc('anonymise_guest', { p_guest_id: guestId })

    if (error) {
      console.error('[anonymiseGuest] rpc error', { error: error.message })
      return { ok: false, reason: 'failed' }
    }

    const result = data as { ok: boolean; reason?: string; original_email?: string }
    if (!result.ok) {
      return {
        ok: false,
        reason: (result.reason as 'upcoming_booking' | 'active_order' | 'payment_in_flight' | 'guest_not_found') ?? 'failed',
      }
    }

    if (!result.original_email) {
      console.error('[anonymiseGuest] success without original_email')
      return { ok: false, reason: 'failed' }
    }

    return { ok: true, originalEmail: result.original_email }
  } catch (err) {
    console.error('[anonymiseGuest] unexpected error', err)
    return { ok: false, reason: 'failed' }
  }
}
