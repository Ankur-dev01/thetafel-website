import 'server-only'
import { randomBytes } from 'node:crypto'
import { createSupabaseServerClientAdmin } from '@/lib/supabase/server'

/**
 * GDPR data-export builder (C8.1).
 *
 * Assembles everything The Tafel holds about one guest — across every
 * restaurant they've ever booked, ordered QR, or ordered takeaway with —
 * into a single JSON-serialisable object. Runs only server-side with the
 * admin (service-role) client, since it reads across restaurants and RLS
 * would otherwise block nearly all of it.
 *
 * Deliberately never includes: token hashes (magic_links.token_hash),
 * provider webhook payloads (payment_intents.metadata), or any other
 * internal-only diagnostic field.
 */

export function generateExportRef(): string {
  const buf = randomBytes(4)
  const n = buf.readUInt32BE(0)
  const s = n.toString(36).toUpperCase().padStart(7, '0').slice(0, 6)
  return `EXP-${s}`
}

const NOTES = {
  nl: {
    guest: 'Je basisgegevens: naam, e-mailadres, telefoonnummer en voorkeuren.',
    bookings: 'Elke reservering die je ooit hebt gemaakt, bij elk restaurant.',
    orders: 'Elke QR- of afhaalbestelling die je ooit hebt geplaatst, met de bestelde items.',
    payments: 'De status, het bedrag en de datum van elke betaling die bij een reservering of bestelling hoort. Nooit de ruwe gegevens van onze betaalprovider.',
    magic_links: 'Metadata over de beveiligde links die we je hebben gestuurd (doel, aanmaakdatum, vervaldatum, gebruikt) — nooit de link zelf.',
    audit_events: 'Een logboek van belangrijke gebeurtenissen op je account, zoals annuleringen of statuswijzigingen.',
  },
  en: {
    guest: 'Your basic details: name, email address, phone number, and preferences.',
    bookings: 'Every reservation you have ever made, at every restaurant.',
    orders: 'Every QR or takeaway order you have ever placed, with the items ordered.',
    payments: 'The status, amount, and date of every payment tied to a booking or order. Never our payment provider’s raw data.',
    magic_links: 'Metadata about the secure links we’ve sent you (purpose, created date, expiry, whether used) — never the link itself.',
    audit_events: 'A log of significant events on your account, such as cancellations or status changes.',
  },
} as const

type Locale = 'nl' | 'en'

export type ExportPayload = {
  exported_at: string
  request_reference: string
  notes: Record<string, string>
  guest: Record<string, unknown> | null
  bookings: Array<Record<string, unknown>>
  orders: Array<Record<string, unknown>>
  payments: Array<Record<string, unknown>>
  magic_links: Array<Record<string, unknown>>
  audit_events: Array<Record<string, unknown>>
}

function restaurantDisplayName(r: {
  display_name?: string | null
  legal_name?: string | null
  name?: string | null
} | null | undefined): string | null {
  if (!r) return null
  return r.display_name?.trim() || r.legal_name?.trim() || r.name?.trim() || null
}

export async function buildDataExport(
  guestId: string,
  locale: Locale
): Promise<ExportPayload> {
  const admin = await createSupabaseServerClientAdmin()

  const { data: guest } = await admin
    .from('guests')
    .select(
      'id, full_name, email, phone, marketing_consent, marketing_consent_at, loyalty_points, loyalty_tier, created_at, updated_at'
    )
    .eq('id', guestId)
    .maybeSingle()

  const { data: bookingsRaw } = await admin
    .from('bookings')
    .select(
      'id, restaurant_id, booking_ref, party_size, slot_time, duration_minutes, status, guest_note, deposit_intent_id, deposit_amount_cents, deposit_currency, cancelled_at, cancelled_by, cancellation_reason, refund_intent_id, created_at, updated_at, restaurants(display_name, legal_name, name, slug)'
    )
    .eq('guest_id', guestId)

  const { data: ordersRaw } = await admin
    .from('orders')
    .select(
      'id, restaurant_id, order_ref, order_type, status, pickup_time, payment_intent_id, payment_status, subtotal_cents, vat_cents, total_cents, currency, guest_note, guest_company_name, refund_intent_id, created_at, updated_at, restaurants(display_name, legal_name, name, slug), order_items(id, name_snapshot, unit_price_cents, quantity, line_total_cents, currency, item_notes, modifiers, created_at)'
    )
    .eq('guest_id', guestId)

  const bookings = (bookingsRaw ?? []).map((b) => {
    const { restaurants, ...rest } = b as typeof b & {
      restaurants: { display_name: string | null; legal_name: string | null; name: string | null; slug: string } | null
    }
    return {
      ...rest,
      restaurant_name: restaurantDisplayName(restaurants),
      restaurant_slug: restaurants?.slug ?? null,
    }
  })

  const orders = (ordersRaw ?? []).map((o) => {
    const { restaurants, order_items, ...rest } = o as typeof o & {
      restaurants: { display_name: string | null; legal_name: string | null; name: string | null; slug: string } | null
      order_items: Array<Record<string, unknown>>
    }
    return {
      ...rest,
      restaurant_name: restaurantDisplayName(restaurants),
      restaurant_slug: restaurants?.slug ?? null,
      items: order_items ?? [],
    }
  })

  const bookingIds = bookings.map((b) => b.id as string)
  const orderIds = orders.map((o) => o.id as string)

  const paymentIntentIds = new Set<string>()
  for (const b of bookings) {
    if (b.deposit_intent_id) paymentIntentIds.add(b.deposit_intent_id as string)
    if (b.refund_intent_id) paymentIntentIds.add(b.refund_intent_id as string)
  }
  for (const o of orders) {
    if (o.payment_intent_id) paymentIntentIds.add(o.payment_intent_id as string)
    if (o.refund_intent_id) paymentIntentIds.add(o.refund_intent_id as string)
  }

  let payments: Array<Record<string, unknown>> = []
  if (paymentIntentIds.size > 0) {
    const { data } = await admin
      .from('payment_intents')
      .select(
        'id, purpose, amount_cents, currency, status, provider_payment_id, refunded_amount_cents, refunded_at, created_at, updated_at, paid_at, failed_at, cancelled_at'
      )
      .in('id', Array.from(paymentIntentIds))
    payments = data ?? []
  }

  const magicLinkFilters: string[] = [`guest_id.eq.${guestId}`]
  if (bookingIds.length > 0) magicLinkFilters.push(`booking_id.in.(${bookingIds.join(',')})`)
  if (orderIds.length > 0) magicLinkFilters.push(`order_id.in.(${orderIds.join(',')})`)

  const { data: magicLinksRaw } = await admin
    .from('magic_links')
    .select('id, purpose, created_at, expires_at, consumed_at')
    .or(magicLinkFilters.join(','))

  const { data: auditFromActor } = await admin
    .from('consumer_audit_logs')
    .select('id, restaurant_id, event_type, event_data, actor_type, booking_id, order_id, created_at')
    .eq('actor_id', guestId)

  const auditFilters: string[] = []
  if (bookingIds.length > 0) auditFilters.push(`booking_id.in.(${bookingIds.join(',')})`)
  if (orderIds.length > 0) auditFilters.push(`order_id.in.(${orderIds.join(',')})`)

  let auditFromLinks: Array<Record<string, unknown>> = []
  if (auditFilters.length > 0) {
    const { data } = await admin
      .from('consumer_audit_logs')
      .select('id, restaurant_id, event_type, event_data, actor_type, booking_id, order_id, created_at')
      .or(auditFilters.join(','))
    auditFromLinks = data ?? []
  }

  const auditById = new Map<string, Record<string, unknown>>()
  for (const row of [...(auditFromActor ?? []), ...auditFromLinks]) {
    auditById.set(row.id as string, row)
  }

  return {
    exported_at: new Date().toISOString(),
    request_reference: generateExportRef(),
    notes: NOTES[locale],
    guest,
    bookings,
    orders,
    payments,
    magic_links: magicLinksRaw ?? [],
    audit_events: Array.from(auditById.values()),
  }
}
