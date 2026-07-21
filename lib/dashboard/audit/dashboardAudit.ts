import 'server-only'

import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'

/**
 * Append-only audit log for dashboard (staff-facing) actions.
 *
 * Mirrors lib/consumer/audit.ts's auditLog shape but writes to
 * dashboard_audit_logs via the service-role client (bypasses RLS by design —
 * audit writes must never be gated by a policy bug). Never throws; a failed
 * audit write must never break the user-visible action it's logging.
 */

export type DashboardAuditInput = {
  restaurantId: string
  staffId?: string | null
  /**
   * Dot-namespaced event name, e.g. 'booking.marked_attended', 'tab.closed',
   * 'menu.item_86ed', 'staff.missing_owner_row'. Keep names stable — they are
   * queried during debugging and by future dashboard surfaces.
   */
  eventType: string
  eventData?: Record<string, unknown>
  bookingId?: string
  orderId?: string
  tabId?: string
  paymentIntentId?: string
  ipAddress?: string | null
}

export async function dashboardAudit(input: DashboardAuditInput): Promise<boolean> {
  try {
    const admin = await createSupabaseServerClientAdmin()
    const { error } = await admin.from('dashboard_audit_logs').insert({
      restaurant_id: input.restaurantId,
      staff_id: input.staffId ?? null,
      event_type: input.eventType,
      event_data: input.eventData ?? {},
      booking_id: input.bookingId ?? null,
      order_id: input.orderId ?? null,
      tab_id: input.tabId ?? null,
      payment_intent_id: input.paymentIntentId ?? null,
      ip_address: input.ipAddress ?? null,
    })

    if (error) {
      console.error('[dashboardAudit] insert failed', {
        eventType: input.eventType,
        restaurantId: input.restaurantId,
        error: error.message,
      })
      return false
    }

    console.log('[dashboard-audit]', {
      type: input.eventType,
      restaurantId: input.restaurantId,
      staffId: input.staffId,
      bookingId: input.bookingId,
      orderId: input.orderId,
      tabId: input.tabId,
    })

    return true
  } catch (err) {
    console.error('[dashboardAudit] unexpected error', err)
    return false
  }
}
