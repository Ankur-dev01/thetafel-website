import type { DashboardIconKey } from '@/lib/dashboard/nav'

/**
 * Placeholder-stub nav icons for D0.2. D0.3 replaces these with the real
 * hand-drawn set from components/dashboard/icons/.
 */

type IconProps = React.SVGProps<SVGSVGElement>

function StubIcon(props: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="20"
      height="20"
      aria-hidden="true"
      {...props}
    >
      <rect x="4.2" y="4.4" width="15.6" height="15.3" rx="3.5" />
    </svg>
  )
}

export function NavIcon({
  icon,
  ...props
}: IconProps & { icon: DashboardIconKey }) {
  void icon
  return <StubIcon {...props} />
}
