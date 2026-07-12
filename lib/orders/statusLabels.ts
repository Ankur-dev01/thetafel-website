// lib/orders/statusLabels.ts
//
// Friendly copy per order status, per locale. Also the polling schedule
// constants per PRD §5 Q5.
//
// Status flow reminder (order_status enum):
//   pending → confirmed → preparing → ready → served → completed
//   cancelled, refunded terminal.
//
// For QR orders in Phase 2 the meaningful states the guest sees are:
//   pending    → order just placed, awaiting kitchen acceptance
//   confirmed  → kitchen has accepted, not started yet
//   preparing  → cooking
//   ready      → runner is bringing it (or has just brought it)
//   served     → at the table (kitchen marks this; guest may not care)
//   completed  → tab settled or shift closed
//   cancelled  → kitchen or staff killed it
//   refunded   → money returned (Phase 3+)

export type OrderStatus =
  | 'pending'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'served'
  | 'completed'
  | 'cancelled'
  | 'refunded'

export type StatusLabel = {
  title: string
  body: string
  tone: 'progress' | 'success' | 'ended' | 'error'
}

const NL: Record<OrderStatus, StatusLabel> = {
  pending: {
    title: 'Bestelling ontvangen',
    body: 'We geven je bestelling zo door aan de keuken.',
    tone: 'progress',
  },
  confirmed: {
    title: 'Doorgezet naar de keuken',
    body: 'De keuken heeft je bestelling gezien en start zo.',
    tone: 'progress',
  },
  preparing: {
    title: 'De keuken is bezig',
    body: 'Je gerechten worden nu bereid.',
    tone: 'progress',
  },
  ready: {
    title: 'Klaar — komt eraan',
    body: 'Je bestelling is klaar en wordt naar je tafel gebracht.',
    tone: 'progress',
  },
  served: {
    title: 'Geserveerd',
    body: 'Smakelijk eten.',
    tone: 'success',
  },
  completed: {
    title: 'Afgerond',
    body: 'Bedankt voor je bezoek.',
    tone: 'ended',
  },
  cancelled: {
    title: 'Bestelling geannuleerd',
    body: 'Vraag een medewerker als je hier iets over wilt weten.',
    tone: 'error',
  },
  refunded: {
    title: 'Betaling teruggestort',
    body: 'De terugbetaling is in gang gezet.',
    tone: 'ended',
  },
}

const EN: Record<OrderStatus, StatusLabel> = {
  pending: {
    title: 'Order received',
    body: "We're sending it to the kitchen now.",
    tone: 'progress',
  },
  confirmed: {
    title: 'Sent to the kitchen',
    body: 'The kitchen has your order and will start shortly.',
    tone: 'progress',
  },
  preparing: {
    title: 'The kitchen is on it',
    body: 'Your dishes are being prepared.',
    tone: 'progress',
  },
  ready: {
    title: 'Ready — on its way',
    body: 'Your order is ready and heading to your table.',
    tone: 'progress',
  },
  served: {
    title: 'Served',
    body: 'Enjoy your meal.',
    tone: 'success',
  },
  completed: {
    title: 'All done',
    body: 'Thanks for coming in.',
    tone: 'ended',
  },
  cancelled: {
    title: 'Order cancelled',
    body: 'Please speak to a staff member if you have any questions.',
    tone: 'error',
  },
  refunded: {
    title: 'Refunded',
    body: 'Your refund has been started.',
    tone: 'ended',
  },
}

export function getStatusLabel(status: OrderStatus, locale: 'nl' | 'en'): StatusLabel {
  const table = locale === 'en' ? EN : NL
  return table[status] ?? table.pending
}

// ── Polling schedule (PRD §5 Q5) ────────────────────────────────────────────
// Phase 1: first 10 minutes, every 8 seconds.
// Phase 2: next 30 minutes, every 30 seconds.
// Phase 3: stop polling after 40 minutes.
export const POLL_PHASES = {
  fastIntervalMs: 8_000,
  fastPhaseDurationMs: 10 * 60_000,
  slowIntervalMs: 30_000,
  slowPhaseDurationMs: 30 * 60_000,
  totalDurationMs: 40 * 60_000,
} as const
