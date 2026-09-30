/**
 * Canonical public origin for URLs we hand to third parties (Mollie webhook and
 * redirect URLs) — never hand-roll `process.env.X || 'https://thetafel.nl'`.
 *
 * Production is ALWAYS https://www.thetafel.nl: the apex 307-redirects to www
 * and the redirect drops headers, and a missing env var used to send webhooks to
 * localhost. Everywhere else the configured env var is used, then localhost.
 */
export const PRODUCTION_ORIGIN = 'https://www.thetafel.nl'

export function publicOrigin(): string {
  if (process.env.VERCEL_ENV === 'production') return PRODUCTION_ORIGIN
  const configured = process.env.NEXT_PUBLIC_SITE_URL || process.env.QR_BASE_URL || 'http://localhost:3000'
  // A configured apex is normalised to www for the same redirect reason.
  return configured.replace(/^https:\/\/thetafel\.nl(?=\/|$)/, PRODUCTION_ORIGIN).replace(/\/$/, '')
}

/**
 * Where the customer's BROWSER should land after Mollie. Same as publicOrigin()
 * on deployed builds; in local dev it is always the dev server, so the flow
 * returns to localhost instead of the public site.
 */
export function redirectOrigin(): string {
  return process.env.NODE_ENV === 'production' ? publicOrigin() : 'http://localhost:3000'
}
