import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import type { ContractContext, ContractLocale, RenderedContract } from './types'
import {
  TIER_MONTHLY_CENTS,
  applyVat,
  VAT_RATE_BPS,
} from '@/lib/pricing/subscription'
import {
  CURRENT_CONTRACT_VERSION,
  CURRENT_TERMS_VERSION,
  CURRENT_DPA_VERSION,
} from '@/lib/legal/versions'

// ── Template cache ─────────────────────────────────────────────────────────

const templateCache: Partial<Record<ContractLocale, string>> = {}

export async function loadTemplate(locale: ContractLocale): Promise<string> {
  if (templateCache[locale]) return templateCache[locale]!
  const filePath = path.join(
    process.cwd(),
    'lib',
    'contracts',
    'v1.0',
    `contract_${locale}.md`
  )
  const raw = await fs.readFile(filePath, 'utf-8')
  // Strip the draft-notice blockquote lines before caching; they contain
  // un-interpolatable placeholders ({{dubbele_accolades}}) and are internal
  // metadata not intended for restaurant display.
  const stripped = raw
    .split('\n')
    .filter((line) => !line.startsWith('>'))
    .join('\n')
  templateCache[locale] = stripped
  return stripped
}

// ── Formatting helpers ──────────────────────────────────────────────────────

function fmtAmount(cents: number): string {
  return new Intl.NumberFormat('nl-NL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)
}

function fmtDateNL(dateStr: string): string {
  return new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(dateStr))
}

function fmtDateEN(dateStr: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(dateStr))
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate)
  d.setDate(d.getDate() + days)
  return d.toISOString()
}

// ── Address ─────────────────────────────────────────────────────────────────

type RestaurantForContext = {
  legal_name: string | null
  kvk_number: string | null
  legal_address_street: string | null
  legal_address_house_number: string | null
  legal_address_house_letter: string | null
  legal_address_house_number_addition: string | null
  legal_address_postcode: string | null
  legal_address_city: string | null
  service_reservations_enabled: boolean
  service_takeaway_enabled: boolean
  service_qr_enabled: boolean
  subscription_tier: 'starter' | 'plus' | 'premium' | null
}

type SubscriptionForContext = {
  tier: 'starter' | 'plus' | 'premium'
  trial_ends_at: string
  monthly_amount_cents: number
}

type PaymentForContext = {
  kind: string
  status: string
  amount_cents: number
  description: string | null
}

function buildAddress(r: RestaurantForContext): string {
  const streetPart = [
    r.legal_address_street,
    r.legal_address_house_number,
    r.legal_address_house_letter,
    r.legal_address_house_number_addition,
  ]
    .filter(Boolean)
    .join(' ')
  const cityPart = [r.legal_address_postcode, r.legal_address_city]
    .filter(Boolean)
    .join(' ')
  return [streetPart, cityPart].filter(Boolean).join(', ') || '—'
}

// ── One-time fees breakdown ─────────────────────────────────────────────────

export function buildOnetimeFeesBreakdown(
  payments: PaymentForContext[],
  locale: ContractLocale
): string {
  const lines = payments
    .filter(
      (p) =>
        p.kind.startsWith('onetime_') &&
        p.status !== 'failed' &&
        p.status !== 'refunded'
    )
    .map((p) => {
      const grossCents = p.amount_cents
      const netCents = Math.round((grossCents * 10000) / (10000 + VAT_RATE_BPS))
      const netFmt = fmtAmount(netCents)
      const grossFmt = fmtAmount(grossCents)

      let label: string
      if (locale === 'nl') {
        if (p.kind === 'onetime_qr_setup') {
          label = p.description ?? 'QR setup pakket'
        } else {
          label = p.description ?? 'Extra QR-tafels'
        }
        return `- ${label}: €${netFmt} ex. BTW (€${grossFmt} incl.)`
      } else {
        if (p.kind === 'onetime_qr_setup') {
          label = p.description ?? 'QR setup package'
        } else {
          label = p.description ?? 'Extra QR tables'
        }
        return `- ${label}: €${netFmt} ex. BTW (€${grossFmt} incl.)`
      }
    })

  if (lines.length === 0) {
    return locale === 'nl'
      ? '- Geen eenmalige vergoedingen'
      : '- No one-time fees'
  }
  return lines.join('\n')
}

function calcOnetimeTotals(payments: PaymentForContext[]): {
  totalNetCents: number
  totalGrossCents: number
} {
  const relevant = payments.filter(
    (p) =>
      p.kind.startsWith('onetime_') &&
      p.status !== 'failed' &&
      p.status !== 'refunded'
  )
  const totalGrossCents = relevant.reduce((s, p) => s + p.amount_cents, 0)
  const totalNetCents = Math.round(
    (totalGrossCents * 10000) / (10000 + VAT_RATE_BPS)
  )
  return { totalNetCents, totalGrossCents }
}

// ── Context builder ─────────────────────────────────────────────────────────

export function buildContext(args: {
  restaurant: RestaurantForContext
  subscription: SubscriptionForContext
  payments: PaymentForContext[]
}): ContractContext {
  const { restaurant, subscription, payments } = args

  const tier = subscription.tier
  const netMonthlyCents = TIER_MONTHLY_CENTS[tier]
  const { grossCents: grossMonthlyCents } = applyVat(netMonthlyCents)

  const trialEndIso = subscription.trial_ends_at
  const firstBillingIso = addDays(trialEndIso, 1)

  const { totalNetCents, totalGrossCents } = calcOnetimeTotals(payments)

  const services: { nl: string[]; en: string[] } = { nl: [], en: [] }
  if (restaurant.service_reservations_enabled) {
    services.nl.push('Reserveringen')
    services.en.push('Reservations')
  }
  if (restaurant.service_takeaway_enabled) {
    services.nl.push('Afhalen')
    services.en.push('Takeaway')
  }
  if (restaurant.service_qr_enabled) {
    services.nl.push('QR-bestellen')
    services.en.push('QR ordering')
  }

  const placeholder_nl = '(geregistreerd bij ondertekening)'
  const placeholder_en = '(recorded at signing)'

  return {
    contract_version: CURRENT_CONTRACT_VERSION,
    terms_version: CURRENT_TERMS_VERSION,
    dpa_version: CURRENT_DPA_VERSION,
    restaurant_legal_name: restaurant.legal_name ?? '—',
    restaurant_kvk: restaurant.kvk_number ?? '—',
    restaurant_btw_or_dash: '—',
    restaurant_address: buildAddress(restaurant),
    services_nl: services.nl.join(', ') || '—',
    services_en: services.en.join(', ') || '—',
    tier_name:
      tier.charAt(0).toUpperCase() + tier.slice(1),
    tier_monthly_ex_vat: fmtAmount(netMonthlyCents),
    tier_monthly_incl_vat: fmtAmount(grossMonthlyCents),
    onetime_fees_breakdown_nl: buildOnetimeFeesBreakdown(payments, 'nl'),
    onetime_fees_breakdown_en: buildOnetimeFeesBreakdown(payments, 'en'),
    onetime_total_ex_vat: fmtAmount(totalNetCents),
    onetime_total_incl_vat: fmtAmount(totalGrossCents),
    trial_end_date_nl: fmtDateNL(trialEndIso),
    trial_end_date_en: fmtDateEN(trialEndIso),
    first_billing_date_nl: fmtDateNL(firstBillingIso),
    first_billing_date_en: fmtDateEN(firstBillingIso),
    effective_date_placeholder: placeholder_nl,
    signed_ip_placeholder: placeholder_nl,
    signed_user_agent_placeholder: placeholder_nl,
    document_hash_placeholder: placeholder_nl,
  }
}

// ── Interpolation ───────────────────────────────────────────────────────────

export function interpolate(
  template: string,
  context: Record<string, string>
): string {
  return template.replace(/\{\{([a-z_]+)\}\}/g, (match, key: string) => {
    if (!(key in context)) {
      throw new Error(
        `Contract template contains unknown placeholder: {{${key}}}`
      )
    }
    return context[key]!
  })
}

// ── Main render function ────────────────────────────────────────────────────

export async function renderContract(
  locale: ContractLocale,
  restaurant: RestaurantForContext,
  subscription: SubscriptionForContext,
  payments: PaymentForContext[]
): Promise<RenderedContract> {
  const [template, ctx] = await Promise.all([
    loadTemplate(locale),
    Promise.resolve(buildContext({ restaurant, subscription, payments })),
  ])

  const placeholderText =
    locale === 'nl'
      ? '(geregistreerd bij ondertekening)'
      : '(recorded at signing)'

  const renderCtx: Record<string, string> = {
    contract_version: ctx.contract_version,
    effective_date_placeholder: placeholderText,
    restaurant_legal_name: ctx.restaurant_legal_name,
    restaurant_kvk: ctx.restaurant_kvk,
    restaurant_btw_or_dash: ctx.restaurant_btw_or_dash,
    restaurant_address: ctx.restaurant_address,
    services_nl: ctx.services_nl,
    services_en: ctx.services_en,
    tier_name: ctx.tier_name,
    tier_monthly_ex_vat: ctx.tier_monthly_ex_vat,
    tier_monthly_incl_vat: ctx.tier_monthly_incl_vat,
    onetime_fees_breakdown_nl: ctx.onetime_fees_breakdown_nl,
    onetime_fees_breakdown_en: ctx.onetime_fees_breakdown_en,
    onetime_total_ex_vat: ctx.onetime_total_ex_vat,
    onetime_total_incl_vat: ctx.onetime_total_incl_vat,
    first_billing_date_nl: ctx.first_billing_date_nl,
    first_billing_date_en: ctx.first_billing_date_en,
    terms_version: ctx.terms_version,
    dpa_version: ctx.dpa_version,
    signed_ip_placeholder: placeholderText,
    signed_user_agent_placeholder: placeholderText,
    document_hash_placeholder: placeholderText,
  }

  const markdown = interpolate(template, renderCtx)
  const hash = crypto.createHash('sha256').update(markdown, 'utf8').digest('hex')

  return { locale, markdown, hash }
}
