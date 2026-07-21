export type DashboardAlertId =
  | 'mollie_broken'
  | 'payments_failed_today'
  | 'orders_ready_stale'
  | 'tabs_open_long'
  | 'bookings_deposit_pending'
  | 'notifications_failed_today'

export type DashboardAlertTone = 'danger' | 'warning' | 'neutral'

export type DashboardAlert = {
  id: DashboardAlertId
  priority: 1 | 2 | 3 | 4 | 5 | 6 // PRD §4.1 order
  tone: DashboardAlertTone
  label_nl: string // one-line summary, already interpolated
  label_en: string
  action_href: string // deep link into the fix path
  action_label_nl: string
  action_label_en: string
  meta?: Record<string, string | number> // for logging/testing — not rendered
}
