import type { StaffRole } from '@/lib/dashboard/nav'

export type { StaffRole }

/**
 * The working superset of dashboard actions D8.2 will gate per role. Every
 * mutating route from D1 onward calls assertDashboardWriteAllowed with one
 * of these; miss one here and D8.2 will discover it when building the real
 * matrix.
 */
export type DashboardAction =
  | 'booking.mark_attended'
  | 'booking.mark_no_show'
  | 'booking.cancel'
  | 'booking.edit'
  | 'booking.walk_in.create'
  | 'order.accept'
  | 'order.status.advance'
  | 'order.cancel'
  | 'tab.open'
  | 'tab.close'
  | 'tab.write_off'
  | 'menu.item.edit'
  | 'menu.item.86'
  | 'menu.category.edit'
  | 'settings.hours.edit'
  | 'settings.floor.edit'
  | 'settings.booking.edit'
  | 'settings.ordering.edit'
  | 'settings.qr.edit'
  | 'settings.notifications.edit'
  | 'settings.branding.edit'
  | 'settings.staff.invite'
  | 'settings.staff.deactivate'
  | 'settings.staff.role_change'
  | 'settings.payments.reconnect'
  | 'settings.billing.change_tier'
  | 'settings.privacy.act'
  | 'guest.note.edit'
  | 'guest.export'
  | 'restaurant.pause'
  | 'restaurant.resume'

/**
 * Stub permission map: owner passes everything until D8.2 implements the
 * real per-role matrix. Every other role is denied so no D1–D7 route can
 * accidentally rely on staff-role gating that doesn't exist yet.
 */
export function can(role: StaffRole, action: DashboardAction): boolean {
  void action
  if (role === 'owner') return true
  return false
}
