/**
 * CSV for the guest export (PRD §4.5). Dutch-Excel friendly: UTF-8 with BOM,
 * `;` separator, CRLF rows. Pure — unit-testable without a server.
 */

export const CSV_BOM = '﻿'
export const CSV_SEP = ';'

/**
 * Neutralise spreadsheet formula injection: a cell that starts with = + - @
 * (or a tab / carriage return) is prefixed with an apostrophe so Excel treats
 * it as text. Guest names and phone numbers are guest-controlled input.
 */
export function neutraliseFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
}

/** Escape one cell: formula-neutralise, then quote if it has a separator, quote or newline. */
export function csvCell(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined) return ''
  const s = neutraliseFormula(String(raw))
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function csvRow(cells: Array<string | number | null | undefined>): string {
  return cells.map(csvCell).join(CSV_SEP)
}

export type GuestCsvInput = {
  name: string
  email: string | null
  phone: string | null
  visits: number
  lastVisit: string | null
  spendCents: number
  marketingConsent: boolean
  marketingConsentAt: string | null
  vip: boolean
}

export type GuestCsvLabels = {
  name: string
  email: string
  phone: string
  visits: string
  lastVisit: string
  totalSpend: string
  marketingConsent: string
  marketingConsentDate: string
  vip: string
  yes: string
  no: string
}

function dateOnly(iso: string | null): string {
  if (!iso) return ''
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Amsterdam' }).format(new Date(iso)) // YYYY-MM-DD
}

/** `12,50` — decimal comma, no currency symbol (a number column in Dutch Excel). */
function euros(cents: number): string {
  return (cents / 100).toFixed(2).replace('.', ',')
}

export function buildGuestCsv(rows: GuestCsvInput[], labels: GuestCsvLabels, opts: { includeVip: boolean }): string {
  const header = [
    labels.name,
    labels.email,
    labels.phone,
    labels.visits,
    labels.lastVisit,
    labels.totalSpend,
    labels.marketingConsent,
    labels.marketingConsentDate,
    ...(opts.includeVip ? [labels.vip] : []),
  ]
  const lines = [csvRow(header)]
  for (const r of rows) {
    lines.push(
      csvRow([
        r.name,
        r.email,
        r.phone,
        r.visits,
        dateOnly(r.lastVisit),
        euros(r.spendCents),
        r.marketingConsent ? labels.yes : labels.no,
        r.marketingConsent ? dateOnly(r.marketingConsentAt) : '',
        ...(opts.includeVip ? [r.vip ? labels.yes : labels.no] : []),
      ]),
    )
  }
  return CSV_BOM + lines.join('\r\n') + '\r\n'
}
