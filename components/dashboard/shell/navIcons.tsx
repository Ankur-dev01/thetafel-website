import type { DashboardIconKey } from '@/lib/dashboard/nav'
import {
  CalendarDay,
  Chair,
  Plate,
  Receipt,
  GuestBook,
  ChefHat,
  ChartBars,
  Gear,
} from '@/components/dashboard/icons'

/**
 * Maps nav icon keys to the hand-drawn icon set (D0.3).
 */

type IconProps = React.SVGProps<SVGSVGElement>

function MoreDots(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width="20" height="20" aria-hidden="true" {...props}>
      <path d="M5.6 12h.2" />
      <path d="M11.9 12.1h.2" />
      <path d="M18.2 12h.2" />
    </svg>
  )
}

const ICONS: Record<DashboardIconKey, (props: IconProps) => React.ReactElement> = {
  today: CalendarDay,
  bookings: Chair,
  orders: Plate,
  tabs: Receipt,
  guests: GuestBook,
  menu: ChefHat,
  analytics: ChartBars,
  settings: Gear,
  more: MoreDots,
}

export function NavIcon({
  icon,
  ...props
}: IconProps & { icon: DashboardIconKey }) {
  const Icon = ICONS[icon]
  return <Icon {...props} />
}
