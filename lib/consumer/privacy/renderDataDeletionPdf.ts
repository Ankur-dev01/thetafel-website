import 'server-only'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { PDFDocument, PageSizes, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'

/**
 * Human-readable PDF confirmation for GDPR erasure (C8.2).
 *
 * Reuses the exact font-bundling/layout approach proven in
 * renderDataExportPdf.ts (same lib/consumer/privacy/fonts/*.ttf, same
 * font-loading convention as lib/qr/render.ts). Kept as a self-contained
 * file-scoped Layout, matching how each email/PDF template in this codebase
 * owns its own small rendering helpers rather than sharing one abstraction.
 *
 * Deliberately never includes the guest's original PII — by the time this
 * renders, the guest row has already been anonymised. If they wanted a copy
 * of their data, that's the export flow (C8.1), not this one.
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
    title: 'Bevestiging van verwijdering',
    coverIntro: (ref: string) =>
      `Je verzoek om je gegevens te verwijderen is verwerkt. Referentie: ${ref}.`,
    referenceLabel: 'Referentie',
    section_removed: 'Wat is verwijderd',
    removed_body:
      'Je naam, e-mailadres en telefoonnummer zijn vervangen door plaatshouders. Eventuele persoonlijke notities die je bij restaurants had achtergelaten, zijn gewist.',
    section_retained: 'Wat is bewaard (en waarom)',
    retained_body:
      'Je reserveringen en bestellingen blijven als geanonimiseerde transactiegegevens in het systeem staan. De Wet op de Rijksbelastingen (art. 52) verplicht restaurants deze gegevens zeven jaar te bewaren. Niets in deze gegevens kan nog naar jou worden herleid.',
    contact: 'Vragen? Neem contact op via hallo@thetafel.nl.',
    footer: (date: string, ref: string) => `Gegenereerd op ${date}. Referentie: ${ref}.`,
  },
  en: {
    title: 'Data deletion confirmation',
    coverIntro: (ref: string) =>
      `Your request to delete your data has been processed. Reference: ${ref}.`,
    referenceLabel: 'Reference',
    section_removed: 'What was removed',
    removed_body:
      'Your name, email address, and phone number have been replaced with placeholders. Any personal notes you left with restaurants have been cleared.',
    section_retained: 'What was retained (and why)',
    retained_body:
      'Your bookings and orders remain in the system as anonymised transaction records. Dutch tax law (Wet op de Rijksbelastingen art. 52) requires restaurants to keep these records for seven years. Nothing in these records can be linked back to you.',
    contact: 'Questions? Reach us at hallo@thetafel.nl.',
    footer: (date: string, ref: string) => `Generated on ${date}. Reference: ${ref}.`,
  },
} as const

function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', {
    timeZone: 'Europe/Amsterdam',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

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
  page: PDFPage
  y: number
  fonts: { black: PDFFont; regular: PDFFont; bold: PDFFont }

  constructor(page: PDFPage, fonts: { black: PDFFont; regular: PDFFont; bold: PDFFont }) {
    this.page = page
    this.fonts = fonts
    this.page.drawRectangle({ x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT, color: CREAM })
    this.y = PAGE_HEIGHT - MARGIN
  }

  gap(amount: number) {
    this.y -= amount
  }

  heading(text: string, opts: { size?: number; color?: RGB } = {}) {
    const size = opts.size ?? 16
    this.y -= size
    this.page.drawText(text, { x: MARGIN, y: this.y, size, font: this.fonts.black, color: opts.color ?? AMBER })
    this.y -= 10
  }

  paragraph(text: string, opts: { size?: number; color?: RGB; font?: PDFFont } = {}) {
    const size = opts.size ?? 10.5
    const font = opts.font ?? this.fonts.regular
    const lineHeight = size * 1.45
    const lines = wrapText(text, font, size, CONTENT_WIDTH)
    for (const line of lines) {
      this.y -= lineHeight
      this.page.drawText(line, { x: MARGIN, y: this.y, size, font, color: opts.color ?? NIGHT })
    }
  }

  keyValueRow(label: string, value: string) {
    const size = 10
    const lineHeight = size * 1.8
    this.y -= lineHeight
    this.page.drawText(label, { x: MARGIN, y: this.y, size, font: this.fonts.bold, color: STONE })
    this.page.drawText(value, { x: MARGIN + 160, y: this.y, size, font: this.fonts.regular, color: NIGHT })
  }
}

export async function renderDataDeletionPdf(
  requestReference: string,
  generatedAtIso: string,
  locale: Locale
): Promise<Buffer> {
  const t = COPY[locale]
  const fontBytes = await loadFonts()

  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  const black = await doc.embedFont(fontBytes.black)
  const regular = await doc.embedFont(fontBytes.regular)
  const bold = await doc.embedFont(fontBytes.bold)

  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT])
  const layout = new Layout(page, { black, regular, bold })

  // ── Cover ──────────────────────────────────────────────────────────────
  layout.y -= 8
  layout.page.drawText('THE TAFEL', { x: MARGIN, y: layout.y, size: 13, font: bold, color: AMBER })
  layout.y -= 40
  layout.page.drawText(t.title, { x: MARGIN, y: layout.y, size: 26, font: black, color: NIGHT })
  layout.y -= 30
  layout.paragraph(t.coverIntro(requestReference))
  layout.gap(20)

  layout.keyValueRow(t.referenceLabel, requestReference)
  layout.gap(16)

  // ── What was removed ─────────────────────────────────────────────────────
  layout.heading(t.section_removed)
  layout.paragraph(t.removed_body)
  layout.gap(16)

  // ── What was retained ────────────────────────────────────────────────────
  layout.heading(t.section_retained)
  layout.paragraph(t.retained_body)
  layout.gap(20)

  // ── Contact ──────────────────────────────────────────────────────────────
  layout.paragraph(t.contact, { size: 10, color: STONE })

  // ── Footer ───────────────────────────────────────────────────────────────
  const footerText = t.footer(formatDate(generatedAtIso, locale), requestReference)
  const footerSize = 8
  const width = regular.widthOfTextAtSize(footerText, footerSize)
  page.drawText(footerText, {
    x: (PAGE_WIDTH - width) / 2,
    y: MARGIN / 2,
    size: footerSize,
    font: regular,
    color: STONE,
  })

  const bytes = await doc.save()
  return Buffer.from(bytes)
}
