// FailureHistory — pure data render, Server Component.
//
// Groups consumer_audit_logs rows (event_type in email.send_failed /
// whatsapp.send_failed) by the underlying notification kind, inferred
// from event_data.templateKey — NOT event_data.template. Every writer
// of these event types (lib/consumer/email/send.ts,
// lib/consumer/whatsapp/send.ts) uses the camelCase key `templateKey`,
// with values matching the templateKey strings passed into
// sendConsumerEmail/sendWhatsAppMessage at each call site:
// 'booking.confirmation', 'booking.cancellation',
// 'takeaway.order_confirmed', 'takeaway.ready_for_pickup'. Magic-link
// emails are sent via raw resend.emails.send() in the signup /
// resend-magic-link routes, entirely outside sendConsumerEmail, so no
// audit row for them will ever carry a magic-link templateKey — the
// magicLink bucket below is defensive, not currently reachable.

type Labels = {
  sectionTitle: string
  allDelivered: string
  eventColumn: string
  countColumn: string
  latestColumn: string
  bookingConfirmedLabel: string
  bookingCancelledLabel: string
  orderConfirmedLabel: string
  orderReadyLabel: string
  magicLinkLabel: string
  otherLabel: string
}

type FailureRow = {
  event_type: string
  event_data: Record<string, unknown> | null
  created_at: string
}

type Props = {
  failures: FailureRow[]
  labels: Labels
  locale: 'nl' | 'en'
}

function inferEventKind(row: FailureRow): string {
  const templateKey = row.event_data?.templateKey
  if (typeof templateKey !== 'string') return 'other'
  // Email templateKeys use dot notation ('booking.confirmation'). WhatsApp
  // templateKeys use underscore notation with a locale suffix
  // ('booking_confirmation_en' / '_nl') but represent the SAME underlying
  // event (dispatcher.ts's dispatchWhatsApp) — both group under
  // bookingConfirmed so a restaurant sees one unified failure count per
  // event, not split by channel.
  if (templateKey === 'booking.confirmation' || templateKey.startsWith('booking_confirmation_')) {
    return 'bookingConfirmed'
  }
  if (templateKey === 'booking.cancellation') return 'bookingCancelled'
  if (templateKey === 'takeaway.order_confirmed') return 'orderConfirmed'
  if (templateKey === 'takeaway.ready_for_pickup') return 'orderReady'
  // No email currently routes through sendConsumerEmail with a
  // magic-link templateKey — magic-link mail is sent via raw
  // resend.emails.send() in the signup/resend-magic-link routes,
  // entirely outside the audited send path. This bucket is defensive,
  // not reachable today.
  if (templateKey.startsWith('magic_link') || templateKey.startsWith('magic-link')) return 'magicLink'
  return 'other'
}

const labelStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const
const bodyStyle = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 300 } as const

export default function FailureHistory({ failures, labels, locale }: Props) {
  if (failures.length === 0) {
    return (
      <section className="mt-6 bg-white rounded-card p-5" data-testid="notifications-failures-empty">
        <h2 className="text-[15px] text-[#1e1508]" style={labelStyle}>
          {labels.sectionTitle}
        </h2>
        <p className="mt-2 text-[13px] text-[#6f6353]" style={bodyStyle}>
          {labels.allDelivered}
        </p>
      </section>
    )
  }

  const groups = new Map<string, { count: number; latest: string }>()
  for (const f of failures) {
    const kind = inferEventKind(f)
    const existing = groups.get(kind)
    if (existing) {
      existing.count += 1
      if (f.created_at > existing.latest) existing.latest = f.created_at
    } else {
      groups.set(kind, { count: 1, latest: f.created_at })
    }
  }

  const kindLabel = (k: string) => {
    switch (k) {
      case 'bookingConfirmed':
        return labels.bookingConfirmedLabel
      case 'bookingCancelled':
        return labels.bookingCancelledLabel
      case 'orderConfirmed':
        return labels.orderConfirmedLabel
      case 'orderReady':
        return labels.orderReadyLabel
      case 'magicLink':
        return labels.magicLinkLabel
      default:
        return labels.otherLabel
    }
  }

  const rows = Array.from(groups.entries()).sort((a, b) => b[1].count - a[1].count)
  const fmtDate = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <section className="mt-6 bg-white rounded-card p-5" data-testid="notifications-failures-table">
      <h2 className="text-[15px] text-[#1e1508]" style={labelStyle}>
        {labels.sectionTitle}
      </h2>
      <table className="mt-4 w-full text-[13px]">
        <thead>
          <tr className="text-left text-[12px] text-[#8c8577] uppercase tracking-[0.06em]">
            <th className="py-2 font-medium">{labels.eventColumn}</th>
            <th className="py-2 font-medium text-right">{labels.countColumn}</th>
            <th className="py-2 font-medium text-right">{labels.latestColumn}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([kind, g]) => (
            <tr key={kind} className="border-t border-[#f0e8d6]">
              <td className="py-2 text-[#1e1508]">{kindLabel(kind)}</td>
              <td className="py-2 text-[#1e1508] text-right">{g.count}</td>
              <td className="py-2 text-[#6f6353] text-right">{fmtDate.format(new Date(g.latest))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
