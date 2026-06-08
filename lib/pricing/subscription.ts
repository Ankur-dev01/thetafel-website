export type SubscriptionTier = 'starter' | 'plus' | 'premium';
export type QrPlan = 'basic' | 'premium';

/** Monthly subscription price in cents (charged after 84-day trial). */
export const TIER_MONTHLY_CENTS: Record<SubscriptionTier, number> = {
  starter: 0,
  plus: 4700,    // €47/month
  premium: 9700, // €97/month
} as const;

/** Starter free-tier booking ceiling per calendar month. */
export const STARTER_MONTHLY_BOOKING_LIMIT = 30;

/** One-time QR setup fee in cents, by chosen QR plan. */
export const QR_SETUP_CENTS: Record<QrPlan, number> = {
  basic: 11900,   // €119
  premium: 26900, // €269
} as const;

/** Tables included in the QR setup fee. Beyond this count, each extra QR table costs EXTRA_QR_TABLE_CENTS. */
export const QR_INCLUDED_TABLES = 20;

/** Per-table fee in cents for QR setup on tables beyond QR_INCLUDED_TABLES. */
export const EXTRA_QR_TABLE_CENTS = 1100; // €11

/** Free-trial length in days from subscription creation. */
export const TRIAL_DAYS = 84;

export interface PricingInput {
  tier: SubscriptionTier | null;
  qrPlan: QrPlan | null;
  /** Count of tables with is_qr_enabled = true (after soft-delete filter). */
  qrTableCount: number;
}

export interface PricingBreakdown {
  tier: SubscriptionTier | null;
  monthlyCents: number;
  qrPlan: QrPlan | null;
  qrSetupCents: number;
  qrTableCount: number;
  extraQrTableCount: number;
  extraQrTableCents: number;
  totalDueTodayCents: number;
}

/**
 * One-time charges (QR setup + extra QR tables) ONLY apply when `qrPlan` is set.
 * If `qrPlan` is null, both qrSetupCents and extraQrTableCents are 0 regardless
 * of qrTableCount. (No QR plan = no QR setup = no table limit.)
 */
export function calculatePricing(input: PricingInput): PricingBreakdown {
  const { tier, qrPlan, qrTableCount } = input;

  const monthlyCents = tier ? TIER_MONTHLY_CENTS[tier] : 0;

  let qrSetupCents = 0;
  let extraQrTableCount = 0;
  let extraQrTableCents = 0;

  if (qrPlan) {
    qrSetupCents = QR_SETUP_CENTS[qrPlan];
    extraQrTableCount = Math.max(0, qrTableCount - QR_INCLUDED_TABLES);
    extraQrTableCents = extraQrTableCount * EXTRA_QR_TABLE_CENTS;
  }

  const totalDueTodayCents = qrSetupCents + extraQrTableCents;

  return {
    tier,
    monthlyCents,
    qrPlan,
    qrSetupCents,
    qrTableCount,
    extraQrTableCount,
    extraQrTableCents,
    totalDueTodayCents,
  };
}

/** Format cents as a euro string ("€47", "€11,50"). Integer cents render without decimals. */
export function formatEuros(cents: number, locale: 'nl' | 'en' = 'nl'): string {
  if (cents % 100 === 0) {
    return `€${cents / 100}`;
  }
  const euros = (cents / 100).toFixed(2);
  return locale === 'nl' ? `€${euros.replace('.', ',')}` : `€${euros}`;
}

/**
 * Dutch VAT (BTW) rate in basis points. 2100 = 21%.
 *
 * Snapshot this rate onto each subscription / payment row at the time of charge
 * so historical records survive any future statutory rate change. D7.1.B adds
 * a `vat_rate_bps` column to `subscriptions` and `payments` for this purpose.
 */
export const VAT_RATE_BPS = 2100;

export interface VatBreakdown {
  netCents: number;
  vatCents: number;
  grossCents: number;
  vatRateBps: number;
}

/**
 * Apply Dutch VAT to a net (ex-VAT) cents amount.
 *
 * Rounding: VAT cents are rounded half-up (Math.round on positive integers).
 * Gross = net + rounded VAT — never round(net × 1.21) directly, because that
 * breaks Mollie's order-line VAT reconciliation (gross must equal net + vat exactly).
 *
 * Use for every restaurant-facing charge: subscriptions, one-time QR setup,
 * extra QR tables, future top-ups. Always pass .grossCents to Mollie.
 *
 * @example
 *   applyVat(11900) // QR Basic €119 net
 *   // → { netCents: 11900, vatCents: 2499, grossCents: 14399, vatRateBps: 2100 }
 */
export function applyVat(netCents: number): VatBreakdown {
  const vatCents = Math.round((netCents * VAT_RATE_BPS) / 10000);
  return {
    netCents,
    vatCents,
    grossCents: netCents + vatCents,
    vatRateBps: VAT_RATE_BPS,
  };
}
