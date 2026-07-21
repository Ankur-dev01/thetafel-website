export default function ChartBars(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width="20" height="20" aria-hidden="true" {...props}>
      <path d="M4.4 20.1h15.3" />
      <path d="M6.6 20V13" />
      <path d="M11 20V7.3" />
      <path d="M15.4 20v-9.7" />
      <path d="M19.7 19.9V4.6" />
    </svg>
  )
}
