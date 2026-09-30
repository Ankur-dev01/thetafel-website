import 'server-only'
import { escapeHtml } from '@/lib/consumer/email/escape'
import { wrapEmailLayout, type EmailLocale } from '@/lib/consumer/email/layout'

export type StaffInviteEmailInput = {
  locale: EmailLocale
  restaurantName: string
  inviterName: string
  role: 'manager' | 'service' | 'kitchen'
  acceptUrl: string
}

export type RenderedEmail = { subject: string; html: string; text: string }

const ROLE_LABEL = {
  nl: { manager: 'manager', service: 'bediening', kitchen: 'keuken' },
  en: { manager: 'manager', service: 'service', kitchen: 'kitchen' },
} as const

const COPY = {
  nl: {
    subject: (restaurant: string) => `Je bent uitgenodigd voor ${restaurant} op The Tafel`,
    heading: (restaurant: string) => `Uitnodiging voor ${restaurant}`,
    body: (inviter: string, restaurant: string, role: string) =>
      `${inviter} heeft je uitgenodigd om mee te werken aan het dashboard van ${restaurant} als ${role}. Maak je account aan om te beginnen. Deze link is 7 dagen geldig en werkt één keer.`,
    cta: 'Uitnodiging accepteren',
    preview: 'Maak je account aan voor The Tafel',
  },
  en: {
    subject: (restaurant: string) => `You're invited to ${restaurant} on The Tafel`,
    heading: (restaurant: string) => `Invitation to ${restaurant}`,
    body: (inviter: string, restaurant: string, role: string) =>
      `${inviter} invited you to work in the dashboard of ${restaurant} as ${role}. Create your account to get started. This link is valid for 7 days and works once.`,
    cta: 'Accept invitation',
    preview: 'Create your account for The Tafel',
  },
} as const

export function renderStaffInvite(input: StaffInviteEmailInput): RenderedEmail {
  const c = COPY[input.locale]
  const role = ROLE_LABEL[input.locale][input.role]
  const heading = c.heading(input.restaurantName)
  const body = c.body(input.inviterName, input.restaurantName, role)

  const bodyHtml = [
    `<h2 style="margin:0 0 16px;font-size:19px;color:#0f0d08;">${escapeHtml(heading)}</h2>`,
    `<p style="margin:0 0 24px;font-size:14px;line-height:1.5;color:#0f0d08;">${escapeHtml(body)}</p>`,
    '<div style="margin-top:8px;text-align:center;">',
    `  <a href="${escapeHtml(input.acceptUrl)}" style="display:inline-block;padding:14px 28px;background:#d4820a;color:#fdfaf5;font-size:14px;font-weight:600;letter-spacing:0.02em;text-decoration:none;border-radius:999px;">`,
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
  const text = [heading, '', body, '', `${c.cta}: ${input.acceptUrl}`].join('\n')
  return { subject: c.subject(input.restaurantName), html, text }
}
