import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { PDFDocument, PageSizes, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import type { ExportPayload } from './buildDataExport'

/**
 * Human-readable PDF companion to the JSON data export (C8.1b).
 *
 * No PDF-generation utility existed anywhere in this repo before this file —
 * confirmed by search. Built fresh on pdf-lib + @pdf-lib/fontkit, following
 * the same font-bundling convention as lib/qr/render.ts (read a font file
 * from disk via fs + path.join(process.cwd(), ...), cache the parsed result
 * module-level) so Vercel's serverless runtime — which has no system fonts —
 * renders the brand typefaces correctly. See next.config.ts
 * outputFileTracingIncludes for the matching bundle entry.
 */

const [PAGE_WIDTH, PAGE_HEIGHT] = PageSizes.A4
const MARGIN = 56
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2

const CREAM = hexToRgb('#fdfaf5')
const NIGHT = hexToRgb('#0f0d08')
const AMBER = hexToRgb('#d4820a')
const STONE = hexToRgb('#9c8b6a')

function hexToRgb(hex: string): RGB {
  const n = parseInt(hex.replace('#', ''), 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

type FontBundle = { black: Uint8Array; regular: Uint8Array; bold: Uint8Array }
let cachedFonts: FontBundle | null = null

async function loadFonts(): Promise<FontBundle> {
  if (cachedFonts) return cachedFonts
  const dir = path.join(process.cwd(), 'lib/consumer/privacy/fonts')
  const [black, regular, bold] = await Promise.all([
    fs.readFile(path.join(dir, 'Raleway-Black.ttf')),
    fs.readFile(path.join(dir, 'Jost-Regular.ttf')),
    fs.readFile(path.join(dir, 'Jost-Bold.ttf')),
  ])
  cachedFonts = { black, regular, bold }
  return cachedFonts
}

type Locale = 'nl' | 'en'

const COPY = {
  nl: {
    title: 'Jouw gegevensexport',
    coverIntro: (ref: string) =>
      `Dit document bevat alles wat The Tafel over je heeft opgeslagen. Het JSON-bestand dat bij deze e-mail zit bevat dezelfde informatie in machineleesbare vorm. Referentie: ${ref}.`,
    generatedOn: 'Gegenereerd op',
    referenceLabel: 'Referentie',
    section_personal: 'Persoonlijke gegevens',
    field_name: 'Naam',
    field_email: 'E-mailadres',
    field_phone: 'Telefoonnummer',
    field_locale: 'Taalvoorkeur',
    field_since: 'Klant sinds',
    section_bookings: 'Reserveringen',
    no_bookings: 'Geen reserveringen bekend.',
    booking_date: 'Datum',
    booking_party: 'Personen',
    booking_zone: 'Zone',
    booking_status: 'Status',
    booking_notes: 'Notities',
    booking_deposit: (amount: string, refunded: boolean) =>
      `Aanbetaling: ${amount}${refunded ? ' (terugbetaald)' : ''}`,
    section_orders: 'Bestellingen',
    no_orders: 'Geen bestellingen bekend.',
    order_date: 'Datum',
    order_type: 'Type',
    order_type_qr: 'Aan tafel (QR)',
    order_type_takeaway: 'Afhalen',
    order_items: 'Items',
    order_total: 'Totaal',
    order_status: 'Status',
    section_payments: 'Betalingen',
    no_payments: 'Geen betalingen bekend.',
    payment_date: 'Datum',
    payment_purpose: 'Doel',
    payment_amount: 'Bedrag',
    payment_status: 'Status',
    payment_ref: 'Mollie-referentie',
    purpose_deposit: 'Aanbetaling reservering',
    purpose_qr_order: 'QR-bestelling',
    purpose_takeaway_order: 'Afhaalbestelling',
    section_activity: 'Recente activiteit',
    activity_event_col: 'Gebeurtenis',
    no_activity: 'Geen activiteit bekend.',
    activity_more: (n: number) =>
      `Nog ${n} eerdere gebeurtenissen — zie het bijgevoegde JSON-bestand voor de volledige geschiedenis.`,
    footer: (email: string, date: string, ref: string, page: number, total: number) =>
      `Gegenereerd voor ${email} op ${date}. Referentie: ${ref}. Pagina ${page} van ${total}.`,
  },
  en: {
    title: 'Your data export',
    coverIntro: (ref: string) =>
      `This document contains everything The Tafel has on file about you. The JSON file attached alongside this email contains the same information in machine-readable form. Reference: ${ref}.`,
    generatedOn: 'Generated on',
    referenceLabel: 'Reference',
    section_personal: 'Personal information',
    field_name: 'Name',
    field_email: 'Email address',
    field_phone: 'Phone number',
    field_locale: 'Language preference',
    field_since: 'Guest since',
    section_bookings: 'Bookings',
    no_bookings: 'No reservations on file.',
    booking_date: 'Date',
    booking_party: 'Party size',
    booking_zone: 'Zone',
    booking_status: 'Status',
    booking_notes: 'Notes',
    booking_deposit: (amount: string, refunded: boolean) =>
      `Deposit: ${amount}${refunded ? ' (refunded)' : ''}`,
    section_orders: 'Orders',
    no_orders: 'No orders on file.',
    order_date: 'Date',
    order_type: 'Type',
    order_type_qr: 'QR at table',
    order_type_takeaway: 'Takeaway',
    order_items: 'Items',
    order_total: 'Total',
    order_status: 'Status',
    section_payments: 'Payments',
    no_payments: 'No payments on file.',
    payment_date: 'Date',
    payment_purpose: 'Purpose',
    payment_amount: 'Amount',
    payment_status: 'Status',
    payment_ref: 'Mollie reference',
    purpose_deposit: 'Booking deposit',
    purpose_qr_order: 'QR order',
    purpose_takeaway_order: 'Takeaway order',
    section_activity: 'Recent activity',
    activity_event_col: 'Event',
    no_activity: 'No activity on file.',
    activity_more: (n: number) =>
      `${n} earlier events not shown — see the attached JSON file for the complete history.`,
    footer: (email: string, date: string, ref: string, page: number, total: number) =>
      `Generated for ${email} on ${date}. Reference: ${ref}. Page ${page} of ${total}.`,
  },
} as const

const AUDIT_EVENT_LABELS: Record<string, { nl: string; en: string }> = {
  'booking.create.succeeded': { nl: 'Reservering geplaatst', en: 'Booking created' },
  'booking.cancelled_by_guest': { nl: 'Annulering aangevraagd', en: 'Cancellation requested' },
  'booking.change_requested': { nl: 'Wijziging aangevraagd', en: 'Change requested' },
  'order.created': { nl: 'Bestelling geplaatst', en: 'Order placed' },
  'order.status_changed': { nl: 'Bestelstatus gewijzigd', en: 'Order status changed' },
  'order.refunded': { nl: 'Bestelling terugbetaald', en: 'Order refunded' },
  'payment.intent_created': { nl: 'Betaling gestart', en: 'Payment started' },
  'payment.captured': { nl: 'Betaling voltooid', en: 'Payment completed' },
  'payment.refunded': { nl: 'Betaling terugbetaald', en: 'Payment refunded' },
  'magic_link.created': { nl: 'Beveiligde link verstuurd', en: 'Secure link sent' },
  'magic_link.consumed': { nl: 'Beveiligde link gebruikt', en: 'Secure link used' },
  'privacy.data_export_requested': { nl: 'Gegevensexport aangevraagd', en: 'Data export requested' },
  'privacy.data_export_completed': { nl: 'Gegevensexport voltooid', en: 'Data export completed' },
  'email.sent': { nl: 'E-mail verzonden', en: 'Email sent' },
  'notification.dispatched': { nl: 'Melding verzonden', en: 'Notification sent' },
}

function describeAuditEvent(eventType: string, locale: Locale): string {
  const known = AUDIT_EVENT_LABELS[eventType]
  if (known) return known[locale]
  return eventType
    .replace(/[._]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

const PAYMENT_PURPOSE_KEY: Record<string, keyof typeof COPY.nl> = {
  deposit: 'purpose_deposit',
  qr_order: 'purpose_qr_order',
  takeaway_order: 'purpose_takeaway_order',
}

function formatDate(iso: string | null | undefined, locale: Locale): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', {
    timeZone: 'Europe/Amsterdam',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function formatMoney(cents: number | null | undefined, currency: string | null | undefined, locale: Locale): string {
  if (cents == null) return '—'
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'nl-NL', {
    style: 'currency',
    currency: currency || 'EUR',
    minimumFractionDigits: 2,
  }).format(cents / 100)
}

/** Word-wraps text to fit maxWidth, returning an array of lines. */
function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current)
      current = word
    } else {
      current = candidate
    }
  }
  if (current) lines.push(current)
  return lines.length > 0 ? lines : ['']
}

class Layout {
  doc: PDFDocument
  page!: PDFPage
  y = 0
  fonts: { black: PDFFont; regular: PDFFont; bold: PDFFont }

  private constructor(doc: PDFDocument, fonts: { black: PDFFont; regular: PDFFont; bold: PDFFont }) {
    this.doc = doc
    this.fonts = fonts
  }

  static async create(doc: PDFDocument, fonts: { black: PDFFont; regular: PDFFont; bold: PDFFont }) {
    const layout = new Layout(doc, fonts)
    layout.addPage()
    return layout
  }

  addPage() {
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
    this.page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: CREAM })
    this.y = PAGE_HEIGHT - MARGIN
  }

  /** Starts a new page if `height` won't fit before the bottom margin. Returns true if it paged. */
  ensureSpace(height: number): boolean {
    if (this.y - height < MARGIN + 24) {
      this.addPage()
      return true
    }
    return false
  }

  gap(amount: number) {
    this.y -= amount
  }

  heading(text: string, opts: { size?: number; color?: RGB } = {}) {
    const size = opts.size ?? 16
    this.ensureSpace(size + 16)
    this.y -= size
    this.page.drawText(text, {
      x: MARGIN,
      y: this.y,
      size,
      font: this.fonts.black,
      color: opts.color ?? AMBER,
    })
    this.y -= 10
  }

  paragraph(text: string, opts: { size?: number; color?: RGB; font?: PDFFont } = {}) {
    const size = opts.size ?? 10.5
    const font = opts.font ?? this.fonts.regular
    const lineHeight = size * 1.45
    const lines = wrapText(text, font, size, CONTENT_WIDTH)
    for (const line of lines) {
      this.ensureSpace(lineHeight)
      this.y -= lineHeight
      this.page.drawText(line, { x: MARGIN, y: this.y, size, font, color: opts.color ?? NIGHT })
    }
  }

  keyValueRow(label: string, value: string) {
    const size = 10
    const lineHeight = size * 1.8
    this.ensureSpace(lineHeight)
    this.y -= lineHeight
    this.page.drawText(label, { x: MARGIN, y: this.y, size, font: this.fonts.bold, color: STONE })
    this.page.drawText(value, { x: MARGIN + 160, y: this.y, size, font: this.fonts.regular, color: NIGHT })
  }

  /** Simple table: header row (bold, stone) + body rows (regular, night), columns given as [text, widthFraction]. */
  table(headers: string[], rows: string[][], widths: number[]) {
    const colWidths = widths.map((w) => w * CONTENT_WIDTH)
    const headerSize = 9
    const bodySize = 9.5
    const rowPad = 6

    const drawHeaderRow = () => {
      // Header itself never needs to trigger its own repeat logic.
      if (this.y - (headerSize + rowPad * 2) < MARGIN + 24) this.addPage()
      this.y -= headerSize
      let x = MARGIN
      headers.forEach((h, i) => {
        this.page.drawText(h, { x, y: this.y, size: headerSize, font: this.fonts.bold, color: STONE })
        x += colWidths[i]
      })
      this.y -= rowPad
      this.page.drawLine({
        start: { x: MARGIN, y: this.y + 2 },
        end: { x: MARGIN + CONTENT_WIDTH, y: this.y + 2 },
        thickness: 0.5,
        color: STONE,
      })
      this.y -= rowPad
    }

    drawHeaderRow()

    for (const row of rows) {
      // Wrap each cell, then draw the tallest cell's line count for all columns.
      const wrapped = row.map((cell, i) => wrapText(cell, this.fonts.regular, bodySize, colWidths[i] - 8))
      const lineCount = Math.max(...wrapped.map((w) => w.length))
      const rowHeight = lineCount * (bodySize * 1.35) + rowPad
      const paged = this.ensureSpace(rowHeight)
      if (paged) {
        // New page — repeat the header for continuity.
        drawHeaderRow()
      }
      let x = MARGIN
      for (let i = 0; i < row.length; i++) {
        let cy = this.y
        for (const line of wrapped[i]) {
          this.page.drawText(line, { x, y: cy, size: bodySize, font: this.fonts.regular, color: NIGHT })
          cy -= bodySize * 1.35
        }
        x += colWidths[i]
      }
      this.y -= rowHeight
    }
  }
}

export async function renderDataExportPdf(payload: ExportPayload, locale: Locale): Promise<Buffer> {
  const t = COPY[locale]
  const fontBytes = await loadFonts()

  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const black = await doc.embedFont(fontBytes.black)
  const regular = await doc.embedFont(fontBytes.regular)
  const bold = await doc.embedFont(fontBytes.bold)

  const layout = await Layout.create(doc, { black, regular, bold })

  const guest = payload.guest as {
    full_name?: string
    email?: string
    phone?: string | null
    created_at?: string
  } | null

  // ── Cover ──────────────────────────────────────────────────────────────
  layout.y -= 8
  layout.page.drawText('THE TAFEL', {
    x: MARGIN,
    y: layout.y,
    size: 13,
    font: bold,
    color: AMBER,
  })
  layout.y -= 40
  layout.page.drawText(t.title, { x: MARGIN, y: layout.y, size: 28, font: black, color: NIGHT })
  layout.y -= 28
  if (guest?.full_name) {
    layout.page.drawText(guest.full_name, { x: MARGIN, y: layout.y, size: 13, font: regular, color: STONE })
    layout.y -= 22
  }
  layout.paragraph(t.coverIntro(payload.request_reference))
  layout.gap(20)

  // ── Personal information ────────────────────────────────────────────────
  layout.heading(t.section_personal)
  if (guest) {
    layout.keyValueRow(t.field_name, guest.full_name ?? '—')
    layout.keyValueRow(t.field_email, guest.email ?? '—')
    if (guest.phone) layout.keyValueRow(t.field_phone, guest.phone)
    layout.keyValueRow(t.field_since, formatDate(guest.created_at, locale))
  }
  layout.gap(16)

  // ── Bookings, grouped by restaurant ─────────────────────────────────────
  layout.heading(t.section_bookings)
  type BookingRow = {
    restaurant_name: string | null
    slot_time: string
    party_size: number
    zone_name: string | null
    status: string
    guest_note: string | null
    deposit_amount_cents: number | null
    deposit_currency: string | null
    refund_intent_id: string | null
  }
  const bookings = payload.bookings as unknown as BookingRow[]
  if (bookings.length === 0) {
    layout.paragraph(t.no_bookings, { color: STONE })
  } else {
    const byRestaurant = groupBy(bookings, (b) => b.restaurant_name ?? '—')
    for (const [restaurantName, rows] of byRestaurant) {
      layout.heading(restaurantName, { size: 12, color: NIGHT })
      layout.table(
        [t.booking_date, t.booking_party, t.booking_zone, t.booking_status, t.booking_notes],
        rows.map((b) => [
          formatDate(b.slot_time, locale),
          String(b.party_size),
          b.zone_name ?? '—',
          b.status,
          b.guest_note ?? '—',
        ]),
        [0.24, 0.12, 0.16, 0.16, 0.32]
      )
      for (const b of rows) {
        if (b.deposit_amount_cents && b.deposit_amount_cents > 0) {
          layout.paragraph(
            t.booking_deposit(
              formatMoney(b.deposit_amount_cents, b.deposit_currency, locale),
              !!b.refund_intent_id
            ),
            { size: 9, color: STONE }
          )
        }
      }
      layout.gap(10)
    }
  }

  // ── Orders, grouped by restaurant ───────────────────────────────────────
  layout.heading(t.section_orders)
  type OrderRow = {
    restaurant_name: string | null
    created_at: string
    order_type: 'qr' | 'takeaway'
    total_cents: number
    currency: string
    status: string
    items: Array<{ name_snapshot: string; quantity: number }>
  }
  const orders = payload.orders as unknown as OrderRow[]
  if (orders.length === 0) {
    layout.paragraph(t.no_orders, { color: STONE })
  } else {
    const byRestaurant = groupBy(orders, (o) => o.restaurant_name ?? '—')
    for (const [restaurantName, rows] of byRestaurant) {
      layout.heading(restaurantName, { size: 12, color: NIGHT })
      layout.table(
        [t.order_date, t.order_type, t.order_items, t.order_total, t.order_status],
        rows.map((o) => [
          formatDate(o.created_at, locale),
          o.order_type === 'qr' ? t.order_type_qr : t.order_type_takeaway,
          (o.items ?? []).map((it) => `${it.quantity}× ${it.name_snapshot}`).join(', ') || '—',
          formatMoney(o.total_cents, o.currency, locale),
          o.status,
        ]),
        [0.16, 0.14, 0.4, 0.14, 0.16]
      )
      layout.gap(10)
    }
  }

  // ── Payments (flat table) ────────────────────────────────────────────────
  layout.heading(t.section_payments)
  type PaymentRow = {
    created_at: string
    purpose: string
    amount_cents: number
    currency: string
    status: string
    provider_payment_id: string | null
  }
  const payments = payload.payments as unknown as PaymentRow[]
  if (payments.length === 0) {
    layout.paragraph(t.no_payments, { color: STONE })
  } else {
    layout.table(
      [t.payment_date, t.payment_purpose, t.payment_amount, t.payment_status, t.payment_ref],
      payments.map((p) => [
        formatDate(p.created_at, locale),
        t[PAYMENT_PURPOSE_KEY[p.purpose] ?? 'purpose_deposit'] as string,
        formatMoney(p.amount_cents, p.currency, locale),
        p.status,
        p.provider_payment_id ?? '—',
      ]),
      [0.2, 0.24, 0.16, 0.16, 0.24]
    )
  }
  layout.gap(16)

  // ── Recent activity ──────────────────────────────────────────────────────
  layout.heading(t.section_activity)
  type AuditRow = { created_at: string; event_type: string }
  const auditEvents = (payload.audit_events as unknown as AuditRow[])
    .slice()
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  if (auditEvents.length === 0) {
    layout.paragraph(t.no_activity, { color: STONE })
  } else {
    const shown = auditEvents.slice(0, 20)
    layout.table(
      [t.payment_date, t.activity_event_col],
      shown.map((a) => [formatDate(a.created_at, locale), describeAuditEvent(a.event_type, locale)]),
      [0.3, 0.7]
    )
    if (auditEvents.length > 20) {
      layout.paragraph(t.activity_more(auditEvents.length - 20), { size: 9, color: STONE })
    }
  }

  // ── Footer on every page ─────────────────────────────────────────────────
  const pages = doc.getPages()
  const generatedDate = formatDate(payload.exported_at, locale)
  const email = guest?.email ?? ''
  pages.forEach((page, idx) => {
    const footerText = t.footer(email, generatedDate, payload.request_reference, idx + 1, pages.length)
    const size = 8
    const width = regular.widthOfTextAtSize(footerText, size)
    page.drawText(footerText, {
      x: (PAGE_WIDTH - width) / 2,
      y: MARGIN / 2,
      size,
      font: regular,
      color: STONE,
    })
  })

  const bytes = await doc.save()
  return Buffer.from(bytes)
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Array<[string, T[]]> {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const key = keyFn(item)
    const list = map.get(key)
    if (list) list.push(item)
    else map.set(key, [item])
  }
  return Array.from(map.entries())
}
