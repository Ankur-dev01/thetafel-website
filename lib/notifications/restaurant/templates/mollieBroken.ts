import 'server-only'
import { escapeHtml } from '@/lib/consumer/email/escape'
import { wrapEmailLayout, type EmailLocale } from '@/lib/consumer/email/layout'

/**
 * Owner email: the Mollie connection is broken, guests can't pay upfront.
 * Sent at most once per 24h by notifyMollieBrokenOnce.
 */

export type RestaurantMollieBrokenInput = {
  locale: EmailLocale
  restaurantName: string
  /** Absolute URL to /dashboard/settings/payments. */
  paymentsUrl: string
}

export type RenderedEmail = {
  subject: string
  html: string
  text: string
}

const COPY = {
  nl: {
    subject: 'Actie nodig: je Mollie-verbinding werkt niet meer',
    heading: 'Je Mollie-verbinding werkt niet meer',
    body: 'Gasten kunnen nu niet vooruitbetalen bij afhalen en QR-bestellingen. Verbind Mollie opnieuw om betalingen weer mogelijk te maken — dat duurt een minuut.',
    cta: 'Opnieuw verbinden',
    preview: 'Gasten kunnen nu niet vooruitbetalen',
  },
  en: {
    subject: 'Action needed: your Mollie connection stopped working',
    heading: 'Your Mollie connection stopped working',
    body: "Guests can't pay upfront for takeaway and QR orders right now. Reconnect Mollie to turn payments back on — it takes a minute.",
    cta: 'Reconnect',
    preview: "Guests can't pay upfront right now",
  },
} as const

export function renderRestaurantMollieBroken(input: RestaurantMollieBrokenInput): RenderedEmail {
  const c = COPY[input.locale]

  const bodyHtml = [
    `<h2 style="margin:0 0 16px;font-size:19px;color:#0f0d08;">${escapeHtml(c.heading)}</h2>`,
    `<p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#0f0d08;">${escapeHtml(c.body)}</p>`,
    '<div style="margin-top:8px;text-align:center;">',
    `  <a href="${escapeHtml(input.paymentsUrl)}" style="display:inline-block;padding:14px 28px;background:#d4820a;color:#fdfaf5;font-size:14px;font-weight:600;letter-spacing:0.02em;text-decoration:none;border-radius:999px;">`,
    `    ${escapeHtml(c.cta)}`,
    '  </a>',
    '</div>',
  ].join('\n')

  const html = wrapEmailLayout({
    bodyHtml,
    preheader: c.preview,
    restaurantName: input.restaurantName,
    locale: input.locale,
  })

  const text = [c.heading, '', c.body, '', `${c.cta}: ${input.paymentsUrl}`].join('\n')

  return { subject: c.subject, html, text }
}
