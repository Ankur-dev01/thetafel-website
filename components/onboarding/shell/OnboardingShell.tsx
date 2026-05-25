/**
 * OnboardingShell
 *
 * Server component. The spine of every onboarding step page from D2 onward.
 *
 * Responsibilities:
 *   - Resolve the current user via createSupabaseServerClient.
 *   - Redirect unauthenticated or unverified users to /login.
 *   - Resolve the user's restaurant row (or null if they haven't started).
 *   - Redirect already-submitted / already-live restaurants to their status page.
 *   - Render the two-pane layout: dark sidebar + cream main pane.
 *   - Pass resolved restaurant data down to its children.
 *
 * Used in: app/[locale]/onboarding/layout.tsx
 */

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import MobileShellWrapper from './MobileShellWrapper'
import SidebarPlaceholder from './SidebarPlaceholder'

type OnboardingShellProps = {
  locale: 'nl' | 'en'
  children: React.ReactNode
}

export default async function OnboardingShell({
  locale,
  children,
}: OnboardingShellProps) {
  const supabase = await createSupabaseServerClient()
  const localePrefix = locale === 'en' ? '/en' : ''

  // 1. Require authentication.
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    redirect(`${localePrefix}/login`)
  }

  // 2. Require email verification.
  if (!user.email_confirmed_at) {
    const emailParam = user.email
      ? `?email=${encodeURIComponent(user.email)}`
      : ''
    redirect(`${localePrefix}/verify-email${emailParam}`)
  }

  // 3. Resolve the user's restaurant. RLS scopes this to their own row.
  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  // 4. Status-based redirects.
  if (restaurant) {
    if (restaurant.status === 'pending_review') {
      redirect(`${localePrefix}/onboarding/submitted`)
    }
    if (restaurant.status === 'live') {
      redirect(`${localePrefix}/onboarding/live`)
    }
    if (
      restaurant.status === 'suspended' ||
      restaurant.status === 'cancelled'
    ) {
      redirect(`${localePrefix}/login`)
    }
  }

  // 5. Render the shell. Restaurant may be null on first ever visit —
  // the page-level GET to /api/v1/restaurants/draft auto-creates the row
  // on first interaction.
  return (
    <MobileShellWrapper
      sidebar={
        <SidebarPlaceholder
          locale={locale}
          restaurantName={restaurant?.name ?? null}
          currentStep={restaurant?.current_onboarding_step ?? 0}
        />
      }
    >
      {children}
    </MobileShellWrapper>
  )
}
