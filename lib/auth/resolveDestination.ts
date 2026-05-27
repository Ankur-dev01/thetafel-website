import type { Database } from '@/packages/db/types'
import { ALL_STEPS } from '@/lib/onboarding/steps'

type Restaurant = Database['public']['Tables']['restaurants']['Row']

/**
 * Resolve where an authenticated user should be sent after auth.
 *
 * Single source of truth for "what URL does this user belong on?"
 * Used by:
 *   - GET /api/auth/me/destination (called by the login page client after success)
 *   - GET /[locale]/auth/confirm (magic-link callback)
 *
 * Cases (in priority order):
 *   - No restaurant row yet                  → /onboarding/set-password
 *   - status = 'live'                        → /dashboard
 *   - status = 'pending_review'              → /onboarding/submitted
 *   - status = 'suspended' | 'cancelled'     → /login?error=account_unavailable
 *   - status = 'onboarding', step >= 1       → step path from ALL_STEPS
 *   - status = 'onboarding', step === 0      → /onboarding (service picker)
 *   - Anything unexpected                    → /onboarding (safe fallback)
 */
export function resolveDestination(
  restaurant: Pick<
    Restaurant,
    'status' | 'current_onboarding_step'
  > | null,
  locale: 'nl' | 'en'
): string {
  const prefix = locale === 'en' ? '/en' : ''

  if (!restaurant) {
    return `${prefix}/onboarding/set-password`
  }

  if (restaurant.status === 'live') {
    return `${prefix}/dashboard`
  }
  if (restaurant.status === 'pending_review') {
    return `${prefix}/onboarding/submitted`
  }
  if (
    restaurant.status === 'suspended' ||
    restaurant.status === 'cancelled'
  ) {
    return `${prefix}/login?error=account_unavailable`
  }

  // status === 'onboarding'
  const step = restaurant.current_onboarding_step ?? 0
  if (step >= 1) {
    const stepEntry = ALL_STEPS.find((s) => s.id === step)
    if (stepEntry) {
      return `${prefix}${stepEntry.path}`
    }
    // step out of range — fall through to service picker
  }

  return `${prefix}/onboarding`
}
