import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { PDFDocument, PageSizes, degrees, rgb, type PDFFont } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

/**
 * Payment receipt PDF for a paid platform payment (The Tafel → restaurant).
 *
 * Deliberately a receipt ("Betaalbewijs"), not a VAT invoice: payments carry no
 * sequential invoice number, which a Dutch VAT invoice requires. The reference
 * shown is derived from the payment id. Reuses the bundled privacy-PDF fonts.
 */

const [PAGE_WIDTH, PAGE_HEIGHT] = PageSizes.A4
const MARGIN = 56

const NIGHT = rgb(0x0f / 255, 0x0d / 255, 0x08 / 255)
const AMBER = rgb(0xd4 / 255, 0x82 / 255, 0x0a / 255)
const STONE = rgb(0x9c / 255, 0x8b / 255, 0x6a / 255)

// The Tafel = Ontwikkeling Tech Services (see lib/contracts/v1.0/*). Same
// numbers the contract and site footer use. docs/LAUNCH_CHECKLIST.md notes
// they still need confirming against the registration — Ankur's call.
const PROVIDER = {
  name: 'Ontwikkeling Tech Services (The Tafel)',
  kvk: '42027611',
  btw: 'NL005440779B20',
  city: 'Eindhoven',
  email: 'hello@thetafel.nl',
}

type Locale = 'nl' | 'en'

const COPY = {
  nl: {
    title: 'Betaalbewijs',
    reference: 'Referentie',
    date: 'Betaald op',
    from: 'Aanbieder',
    to: 'Restaurant',
    kvk: 'KVK',
    btw: 'BTW',
    description: 'Omschrijving',
    net: 'Bedrag excl. btw',
    vat: (pct: string) => `Btw ${pct}%`,
    total: 'Totaal incl. btw',
    note: 'Dit is een betaalbewijs van een betaling via The Tafel.',
    concept: 'CONCEPT',
  },
  en: {
    title: 'Payment receipt',
    reference: 'Reference',
    date: 'Paid on',
    from: 'Provider',
    to: 'Restaurant',
    kvk: 'KVK',
    btw: 'VAT',
    description: 'Description',
    net: 'Amount excl. VAT',
    vat: (pct: string) => `VAT ${pct}%`,
    total: 'Total incl. VAT',
    note: 'This is a receipt for a payment made through The Tafel.',
    concept: 'CONCEPT',
  },
} as const

export type ReceiptInput = {
  locale: Locale
  paymentId: string
  paidAt: string
  description: string
  currency: string
  grossCents: number
  netCents: number
  vatCents: number
  vatRateBps: number
  restaurant: { legalName: string; kvk: string | null; btw: string | null }
  /** Stamp a visible CONCEPT watermark (used if provider details are unconfirmed). */
  concept?: boolean
}

let cachedFonts: { black: Uint8Array; regular: Uint8Array; bold: Uint8Array } | null = null
async function loadFonts() {
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

function money(cents: number, currency: string, locale: Locale): string {
  return new Intl.NumberFormat(locale === 'en' ? 'en-GB' : 'nl-NL', {
    style: 'currency',
    currency: currency || 'EUR',
  }).format(cents / 100)
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && current) {
      lines.push(current)
      current = w
    } else current = candidate
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

export function receiptReference(paymentId: string): string {
  return `TFL-${paymentId.replace(/-/g, '').slice(0, 8).toUpperCase()}`
}

export async function renderReceiptPdf(input: ReceiptInput): Promise<Uint8Array> {
  const t = COPY[input.locale]
  const fonts = await loadFonts()
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const black = await doc.embedFont(fonts.black)
  const regular = await doc.embedFont(fonts.regular)
  const bold = await doc.embedFont(fonts.bold)
  const page = doc.addPage(PageSizes.A4)
  const width = PAGE_WIDTH - MARGIN * 2

  const dateStr = new Intl.DateTimeFormat(input.locale === 'en' ? 'en-GB' : 'nl-NL', {
    timeZone: 'Europe/Amsterdam',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(input.paidAt))

  let y = PAGE_HEIGHT - MARGIN
  page.drawText('THE TAFEL', { x: MARGIN, y: (y -= 13), size: 13, font: bold, color: AMBER })
  page.drawText(t.title, { x: MARGIN, y: (y -= 38), size: 26, font: black, color: NIGHT })
  y -= 26

  const kv = (label: string, value: string) => {
    page.drawText(label, { x: MARGIN, y, size: 10, font: bold, color: STONE })
    page.drawText(value, { x: MARGIN + 130, y, size: 10.5, font: regular, color: NIGHT })
    y -= 18
  }
  kv(t.reference, receiptReference(input.paymentId))
  kv(t.date, dateStr)
  y -= 14

  const party = (heading: string, lines: string[]) => {
    page.drawText(heading, { x: MARGIN, y, size: 10, font: bold, color: AMBER })
    y -= 16
    for (const l of lines) {
      page.drawText(l, { x: MARGIN, y, size: 10.5, font: regular, color: NIGHT })
      y -= 15
    }
    y -= 10
  }
  party(t.from, [
    PROVIDER.name,
    `${t.kvk}: ${PROVIDER.kvk}  ·  ${t.btw}: ${PROVIDER.btw}`,
    `${PROVIDER.city}  ·  ${PROVIDER.email}`,
  ])
  party(t.to, [
    input.restaurant.legalName,
    `${t.kvk}: ${input.restaurant.kvk ?? '—'}  ·  ${t.btw}: ${input.restaurant.btw ?? '—'}`,
  ])

  page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + width, y }, thickness: 0.6, color: STONE })
  y -= 20
  page.drawText(t.description, { x: MARGIN, y, size: 10, font: bold, color: STONE })
  y -= 16
  for (const line of wrap(input.description, regular, 10.5, width)) {
    page.drawText(line, { x: MARGIN, y, size: 10.5, font: regular, color: NIGHT })
    y -= 15
  }
  y -= 14

  const amountRow = (label: string, value: string, strong = false) => {
    const font = strong ? bold : regular
    page.drawText(label, { x: MARGIN, y, size: 10.5, font, color: NIGHT })
    const w = font.widthOfTextAtSize(value, 10.5)
    page.drawText(value, { x: MARGIN + width - w, y, size: 10.5, font, color: NIGHT })
    y -= 18
  }
  amountRow(t.net, money(input.netCents, input.currency, input.locale))
  amountRow(t.vat(String(input.vatRateBps / 100)), money(input.vatCents, input.currency, input.locale))
  page.drawLine({ start: { x: MARGIN, y: y + 10 }, end: { x: MARGIN + width, y: y + 10 }, thickness: 0.6, color: STONE })
  amountRow(t.total, money(input.grossCents, input.currency, input.locale), true)

  y -= 20
  page.drawText(t.note, { x: MARGIN, y, size: 9, font: regular, color: STONE })

  if (input.concept) {
    page.drawText(t.concept, {
      x: 110,
      y: 260,
      size: 120,
      font: black,
      color: rgb(0.85, 0.2, 0.2),
      opacity: 0.18,
      rotate: degrees(35),
    })
  }

  return doc.save()
}
