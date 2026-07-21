export default function WarningTriangle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" width="20" height="20" aria-hidden="true" {...props}>
      <path d="M12 4.3L21 19.5l-18.1.2z" />
      <path d="M12 9.9v4.2" />
      <path d="M12 16.8v.2" />
    </svg>
  )
}
