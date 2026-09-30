import 'server-only'
import { escapeHtml } from '@/lib/consumer/email/escape'
import { wrapEmailLayout, type EmailLocale } from '@/lib/consumer/email/layout'

/**
 * Owner emails for a failed subscription payment (D6.5): day 1 / 7 / 12 of the
 * grace period, and the day-14 suspension notice. One layout, varying copy.
 */

export type RenderedEmail = { subject: string; html: string; text: string }

export type BillingEmailKind = 'failed_d1' | 'failed_d7' | 'failed_d12' | 'suspended'

export type BillingEmailInput = {
  kind: BillingEmailKind
  locale: EmailLocale
  restaurantName: string
  /** Formatted date the restaurant goes (went) offline for guests. */
  offlineDate: string
  /** Absolute URL to /dashboard/settings/billing. */
  billingUrl: string
}

const COPY = {
  nl: {
    failedSubject: (kind: 'failed_d1' | 'failed_d7' | 'failed_d12') =>
      kind === 'failed_d12'
        ? 'Laatste herinnering: je betaling is nog steeds mislukt'
        : kind === 'failed_d7'
          ? 'Herinnering: je betaling is mislukt'
          : 'Je betaling voor The Tafel is mislukt',
    failedHeading: 'Je betaling is mislukt',
    failedBody: (date: string) =>
      `De maandelijkse betaling voor je The Tafel-abonnement is niet gelukt. We proberen het opnieuw. Wil je je betaalmethode aanpassen? Mail dan naar hello@thetafel.nl. Als de betaling niet lukt, gaat je restaurant op ${date} offline voor gasten.`,
    suspendedSubject: 'Je restaurant is offline voor gasten',
    suspendedHeading: 'Je restaurant staat offline',
    suspendedBody: (date: string) =>
      `Omdat de betaling voor je abonnement sinds 14 dagen mislukt, staat je restaurant sinds ${date} offline voor gasten. Zodra de betaling lukt, gaat je restaurant automatisch weer online. Wil je je betaalmethode aanpassen? Mail dan naar hello@thetafel.nl.`,
    cta: 'Naar facturatie',
    preview: 'Actie nodig voor je abonnement',
  },
  en: {
    failedSubject: (kind: 'failed_d1' | 'failed_d7' | 'failed_d12') =>
      kind === 'failed_d12'
        ? 'Final reminder: your payment has still failed'
        : kind === 'failed_d7'
          ? 'Reminder: your payment failed'
          : 'Your payment for The Tafel failed',
    failedHeading: 'Your payment failed',
    failedBody: (date: string) =>
      `The monthly payment for your The Tafel subscription didn't go through. We'll retry it. To update your payment method, email hello@thetafel.nl. If it still fails, your restaurant goes offline for guests on ${date}.`,
    suspendedSubject: 'Your restaurant is offline for guests',
    suspendedHeading: 'Your restaurant is offline',
    suspendedBody: (date: string) =>
      `Because the payment for your subscription has been failing for 14 days, your restaurant has been offline for guests since ${date}. As soon as a payment goes through it comes back online automatically. To update your payment method, email hello@thetafel.nl.`,
    cta: 'Go to billing',
    preview: 'Action needed for your subscription',
  },
} as const

export function renderBillingEmail(input: BillingEmailInput): RenderedEmail {
  const c = COPY[input.locale]
  const kind = input.kind
  const subject = kind === 'suspended' ? c.suspendedSubject : c.failedSubject(kind)
  const heading = kind === 'suspended' ? c.suspendedHeading : c.failedHeading
  const body = kind === 'suspended' ? c.suspendedBody(input.offlineDate) : c.failedBody(input.offlineDate)

  const bodyHtml = [
    `<h2 style="margin:0 0 16px;font-size:19px;color:#0f0d08;">${escapeHtml(heading)}</h2>`,
    `<p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#0f0d08;">${escapeHtml(body)}</p>`,
    '<div style="margin-top:8px;text-align:center;">',
    `  <a href="${escapeHtml(input.billingUrl)}" style="display:inline-block;padding:14px 28px;background:#d4820a;color:#fdfaf5;font-size:14px;font-weight:600;letter-spacing:0.02em;text-decoration:none;border-radius:999px;">`,
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
  const text = [heading, '', body, '', `${c.cta}: ${input.billingUrl}`].join('\n')
  return { subject, html, text }
}
