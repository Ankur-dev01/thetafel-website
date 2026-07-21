import type { Database } from '@/packages/db/types'

/**
 * Dashboard navigation map (PRD §3).
 *
 * One array drives the desktop sidebar, the phone bottom tab bar, and the
 * "Meer" sheet. `roles` lists who sees the item — in D0 every logged-in
 * user is the owner, so everything renders; D8.3 shapes the nav per role.
 */

export type StaffRole = Database['public']['Enums']['staff_role']

export type DashboardIconKey =
  | 'today'
  | 'bookings'
  | 'orders'
  | 'tabs'
  | 'guests'
  | 'menu'
  | 'analytics'
  | 'settings'
  | 'more'

export type DashboardNavItem = {
  key: string
  /** Locale-less path; prepend the locale prefix when rendering links. */
  path: string
  label_nl: string
  label_en: string
  icon: DashboardIconKey
  roles: StaffRole[]
  /** Item appears in the phone bottom tab bar (max four; "Meer" is added by the bar itself). */
  phoneTab: boolean
}

export const DASHBOARD_NAV_ITEMS: DashboardNavItem[] = [
  {
    key: 'today',
    path: '/dashboard',
    label_nl: 'Vandaag',
    label_en: 'Today',
    icon: 'today',
    roles: ['owner', 'manager', 'service'],
    phoneTab: true,
  },
  {
    key: 'bookings',
    path: '/dashboard/bookings',
    label_nl: 'Reserveringen',
    label_en: 'Bookings',
    icon: 'bookings',
    roles: ['owner', 'manager', 'service'],
    phoneTab: true,
  },
  {
    key: 'orders',
    path: '/dashboard/orders',
    label_nl: 'Bestellingen',
    label_en: 'Orders',
    icon: 'orders',
    roles: ['owner', 'manager', 'service', 'kitchen'],
    phoneTab: true,
  },
  {
    key: 'tabs',
    path: '/dashboard/tabs',
    label_nl: 'Open rekeningen',
    label_en: 'Tabs',
    icon: 'tabs',
    roles: ['owner', 'manager', 'service'],
    phoneTab: false,
  },
  {
    key: 'guests',
    path: '/dashboard/guests',
    label_nl: 'Gasten',
    label_en: 'Guests',
    icon: 'guests',
    roles: ['owner', 'manager', 'service'],
    phoneTab: false,
  },
  {
    key: 'menu',
    path: '/dashboard/menu',
    label_nl: 'Menu',
    label_en: 'Menu',
    icon: 'menu',
    roles: ['owner', 'manager'],
    phoneTab: false,
  },
  {
    key: 'analytics',
    path: '/dashboard/analytics',
    label_nl: 'Inzichten',
    label_en: 'Insights',
    icon: 'analytics',
    roles: ['owner', 'manager'],
    phoneTab: false,
  },
  {
    key: 'settings',
    path: '/dashboard/settings',
    label_nl: 'Instellingen',
    label_en: 'Settings',
    icon: 'settings',
    roles: ['owner', 'manager'],
    phoneTab: false,
  },
]

export function navItemsForRole(role: StaffRole): DashboardNavItem[] {
  return DASHBOARD_NAV_ITEMS.filter((item) => item.roles.includes(role))
}

/**
 * Active-item resolution: exact match for /dashboard (Today), otherwise the
 * longest path prefix wins so /dashboard/settings/hours highlights Settings.
 */
export function activeNavKey(strippedPathname: string): string | null {
  const path = strippedPathname.replace(/\/+$/, '') || '/'
  if (path === '/dashboard') return 'today'
  let best: DashboardNavItem | null = null
  for (const item of DASHBOARD_NAV_ITEMS) {
    if (item.path === '/dashboard') continue
    if (path === item.path || path.startsWith(item.path + '/')) {
      if (!best || item.path.length > best.path.length) best = item
    }
  }
  return best?.key ?? null
}
