/**
 * useResumeRedirect (server-side helper, not a React hook despite the name)
 *
 * Resolves where an authenticated user should land when visiting /onboarding.
 * Extracted from OnboardingShell so it can be reused by the submitted/live
 * pages in D8.
 *
 * Returns null → render the requested page.
 * Returns { path } → redirect there.
 */

import type { Database } from '@/packages/db/types';

type Restaurant = Pick<
  Database['public']['Tables']['restaurants']['Row'],
  'status'
>;

export type ResumeRedirect = { path: string } | null;

export function useResumeRedirect(
  restaurant: Restaurant | null,
  locale: 'nl' | 'en'
): ResumeRedirect {
  const localePrefix = locale === 'en' ? '/en' : '';

  if (!restaurant) return null;

  switch (restaurant.status) {
    case 'pending_review':
      return { path: `${localePrefix}/onboarding/submitted` };
    case 'live':
      return { path: `${localePrefix}/onboarding/live` };
    case 'suspended':
    case 'cancelled':
      return { path: locale === 'en' ? '/en/login' : '/login' };
    case 'onboarding':
    default:
      return null;
  }
}
