import type { StaffRole } from '@/lib/dashboard/nav'

export type { StaffRole }

/**
 * Central permission map (PRD §2.1 / §2.3). Every dashboard API route derives
 * the acting staff member on the server, loads their role from
 * restaurant_staff, and checks `can(role, action)` — via
 * assertDashboardWriteAllowed / resolveMenuMutationContext for writes, and
 * assertDashboardReadAllowed for reads. No client-side-only gating.
 *
 *   owner    everything
 *   manager  everything except billing/payments, legal (business) details,
 *            managing owner/manager accounts (see staff/rolePolicy.ts), and
 *            closing the account
 *   service  Today, Bookings (all booking actions incl. walk-ins), Orders,
 *            Tabs (open/close), Guests read-only, own Account
 *   kitchen  Orders queue status changes + own Account
 *
 * The map is a Record over the action union: adding an action without
 * classifying it is a compile error.
 */
export type DashboardAction =
  | 'booking.read'
  | 'booking.mark_attended'
  | 'booking.mark_no_show'
  | 'booking.cancel'
  | 'booking.edit'
  | 'booking.walk_in.create'
  | 'order.read'
  | 'order.accept'
  | 'order.status.advance'
  | 'order.cancel'
  | 'order.refund'
  | 'tab.read'
  | 'tab.open'
  | 'tab.close'
  | 'tab.write_off'
  | 'menu.read'
  | 'menu.item.edit'
  | 'menu.item.86'
  | 'menu.item.create'
  | 'menu.item.delete'
  | 'menu.item.reorder'
  | 'menu.item.toggle_visibility'
  | 'menu.item.photo.edit'
  | 'menu.category.edit'
  | 'menu.category.create'
  | 'menu.category.delete'
  | 'menu.category.reorder'
  | 'today.read'
  | 'insights.read'
  | 'settings.hours.edit'
  | 'settings.floor.edit'
  | 'settings.booking.edit'
  | 'settings.business.edit'
  | 'settings.ordering.edit'
  | 'settings.qr.edit'
  | 'settings.notifications.edit'
  | 'settings.branding.edit'
  | 'settings.staff.invite'
  | 'settings.staff.deactivate'
  | 'settings.staff.role_change'
  | 'settings.payments.reconnect'
  | 'settings.billing.change_tier'
  | 'settings.billing.cancel'
  | 'settings.privacy.act'
  | 'guests.read'
  | 'guests.note.edit'
  | 'guests.vip.toggle'
  | 'guests.export'
  | 'restaurant.pause'
  | 'restaurant.resume'
  | 'account.self_edit'

const O: StaffRole[] = ['owner']
const OM: StaffRole[] = ['owner', 'manager']
const OMS: StaffRole[] = ['owner', 'manager', 'service']
const ALL: StaffRole[] = ['owner', 'manager', 'service', 'kitchen']

export const PERMISSIONS: Record<DashboardAction, readonly StaffRole[]> = {
  'booking.read': OMS,
  'booking.mark_attended': OMS,
  'booking.mark_no_show': OMS,
  'booking.cancel': OMS,
  'booking.edit': OMS,
  'booking.walk_in.create': OMS,

  'order.read': ALL,
  'order.accept': OMS,
  'order.status.advance': ALL,
  'order.cancel': OMS,
  'order.refund': OM,

  'tab.read': OMS,
  'tab.open': OMS,
  'tab.close': OMS,
  'tab.write_off': OM,

  'menu.read': OM,
  'menu.item.edit': OM,
  'menu.item.86': OM,
  'menu.item.create': OM,
  'menu.item.delete': OM,
  'menu.item.reorder': OM,
  'menu.item.toggle_visibility': OM,
  'menu.item.photo.edit': OM,
  'menu.category.edit': OM,
  'menu.category.create': OM,
  'menu.category.delete': OM,
  'menu.category.reorder': OM,

  'today.read': OMS,
  'insights.read': OM,

  'settings.hours.edit': OM,
  'settings.floor.edit': OM,
  'settings.booking.edit': OM,
  'settings.business.edit': O,
  'settings.ordering.edit': OM,
  'settings.qr.edit': OM,
  'settings.notifications.edit': OM,
  'settings.branding.edit': OM,
  // Target-role limits (managers only manage service/kitchen) live in staff/rolePolicy.ts.
  'settings.staff.invite': OM,
  'settings.staff.deactivate': OM,
  'settings.staff.role_change': OM,
  'settings.payments.reconnect': O,
  'settings.billing.change_tier': O,
  'settings.billing.cancel': O,
  'settings.privacy.act': OM,

  // Guests: owner/manager full; service read-only; kitchen none. Tier gating
  // (Plus+, VIP Premium) is enforced separately via getRestaurantTier.
  'guests.read': OMS,
  'guests.note.edit': OM,
  'guests.vip.toggle': OM,
  'guests.export': OM,

  'restaurant.pause': OM,
  'restaurant.resume': OM,

  'account.self_edit': ALL,
}

export function can(role: StaffRole, action: DashboardAction): boolean {
  return PERMISSIONS[action].includes(role)
}

// ── Page-level view permissions ─────────────────────────────────────────────

/** Most specific prefix first. Unknown /dashboard paths default to owner + manager. */
const PATH_RULES: ReadonlyArray<{ prefix: string; exact?: boolean; roles: readonly StaffRole[] }> = [
  { prefix: '/dashboard/settings/account', roles: ALL },
  { prefix: '/dashboard/settings/billing', roles: O },
  { prefix: '/dashboard/settings/payments', roles: O },
  { prefix: '/dashboard/settings/business', roles: O },
  { prefix: '/dashboard/settings', roles: OM },
  { prefix: '/dashboard/orders', roles: ALL },
  { prefix: '/dashboard/bookings', roles: OMS },
  { prefix: '/dashboard/tabs', roles: OMS },
  { prefix: '/dashboard/guests', roles: OMS },
  { prefix: '/dashboard/menu', roles: OM },
  { prefix: '/dashboard/analytics', roles: OM },
  { prefix: '/dashboard/share', roles: OM },
  { prefix: '/dashboard', exact: true, roles: OMS },
]

/** `path` is locale-less (e.g. "/dashboard/settings/staff"). */
export function canViewPath(role: StaffRole, path: string): boolean {
  const p = path.replace(/\/+$/, '') || '/'
  for (const rule of PATH_RULES) {
    const hit = rule.exact ? p === rule.prefix : p === rule.prefix || p.startsWith(rule.prefix + '/')
    if (hit) return rule.roles.includes(role)
  }
  return OM.includes(role)
}

/** Where a role lands after login / when bounced from a forbidden page. */
export function homePathFor(role: StaffRole): string {
  return role === 'kitchen' ? '/dashboard/orders' : '/dashboard'
}
