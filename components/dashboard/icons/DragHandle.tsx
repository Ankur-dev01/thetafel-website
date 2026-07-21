export default function DragHandle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width="20" height="20" aria-hidden="true" {...props}>
      <path d="M5.4 8.6h13.1" />
      <path d="M5.6 12h12.9" />
      <path d="M5.5 15.4h13" />
    </svg>
  )
}
