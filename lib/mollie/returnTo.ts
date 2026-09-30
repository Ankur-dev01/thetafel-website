/**
 * Whitelist for the post-OAuth landing page. The Mollie reconnect flow may
 * return the owner to the dashboard payments page instead of onboarding;
 * nothing else is ever accepted, so this can't become an open redirect.
 */
export const MOLLIE_RETURN_TO_COOKIE = 'mollie_oauth_return'

const ALLOWED_RETURN_TO = [
  '/dashboard/settings/payments',
  '/en/dashboard/settings/payments',
] as const

export type MollieReturnTo = (typeof ALLOWED_RETURN_TO)[number]

export function parseMollieReturnTo(value: unknown): MollieReturnTo | null {
  if (typeof value !== 'string') return null
  return (ALLOWED_RETURN_TO as readonly string[]).includes(value)
    ? (value as MollieReturnTo)
    : null
}
