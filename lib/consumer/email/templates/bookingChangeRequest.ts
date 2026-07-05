// lib/consumer/email/templates/bookingChangeRequest.ts
//
// Internal email sent to hallo@thetafel.nl when a guest requests a
// change to their booking via the manage page. English-only - this is
// staff-facing.

import 'server-only'
import { escapeHtml } from '../escape'
import { wrapEmailLayout } from '../layout'

export type BookingChangeRequestInput = {
  guestFullName: string
  guestEmail: string
  guestPhone: string
  restaurantName: string
  restaurantSlug: string
  bookingRef: string
  slotTime: string | Date
  partySize: number
  changeKind: 'party_size' | 'time' | 'other'
  message: string
}

export type RenderedChangeRequestEmail = {
  subject: string
  html: string
  text: string
}

function formatSlot(slot: Date | string): string {
  const d = typeof slot === 'string' ? new Date(slot) : slot
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

const KIND_LABEL: Record<BookingChangeRequestInput['changeKind'], string> = {
  party_size: 'Party size change',
  time: 'Time or date change',
  other: 'Other',
}

export function renderBookingChangeRequest(
  input: BookingChangeRequestInput
): RenderedChangeRequestEmail {
  const slotStr = formatSlot(input.slotTime)
  const kindLabel = KIND_LABEL[input.changeKind]
  const subject = `Change request - ${input.restaurantName} (${input.bookingRef})`
  const preheader = `${kindLabel} for booking ${input.bookingRef}`

  const rows: Array<[string, string]> = [
    ['Restaurant', input.restaurantName],
    ['Booking ref', input.bookingRef],
    ['Slot', slotStr],
    ['Party size', String(input.partySize)],
    ['Guest', `${input.guestFullName} <${input.guestEmail}>`],
    ['Guest phone', input.guestPhone],
    ['Change kind', kindLabel],
  ]

  const bodyHtml = [
    '<p style="margin:0 0 16px;font-size:14px;line-height:1.5;color:#0f0d08;">',
    '  A guest has requested a change to their booking:',
    '</p>',
    '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f8f2e6;padding:16px 20px;">',
    '  <tbody>',
    rows
      .map(
        ([k, v]) => `
    <tr>
      <td style="padding:6px 0;font-size:13px;color:#9c8b6a;width:140px;">${escapeHtml(k)}</td>
      <td style="padding:6px 0;font-size:14px;color:#0f0d08;">${escapeHtml(v)}</td>
    </tr>`
      )
      .join(''),
    '  </tbody>',
    '</table>',
    '<p style="font-size:14px;color:#0f0d08;margin:24px 0 8px;font-weight:600;">',
    '  Message from guest',
    '</p>',
    '<p style="font-size:14px;color:#0f0d08;line-height:1.5;margin:0;white-space:pre-wrap;">',
    `  ${escapeHtml(input.message)}`,
    '</p>',
    '<p style="font-size:12px;color:#9c8b6a;margin:32px 0 0;">',
    '  Reply to this email to respond directly to the guest (Reply-To is set to their address).',
    '</p>',
  ].join('\n')

  const html = wrapEmailLayout({
    locale: 'en',
    preheader,
    bodyHtml,
    restaurantName: input.restaurantName,
  })

  const text = [
    subject,
    '',
    ...rows.map(([k, v]) => `${k}: ${v}`),
    '',
    'Message:',
    input.message,
    '',
    'Reply to this email to respond directly to the guest.',
  ].join('\n')

  return { subject, html, text }
}
