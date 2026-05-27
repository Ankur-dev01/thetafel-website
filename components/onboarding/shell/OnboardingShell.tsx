/**
 * OnboardingShell
 *
 * Server component. The spine of every onboarding step page from D2 onward.
 *
 * Responsibilities:
 *   - Resolve the current user via createSupabaseServerClient.
 *   - Redirect unauthenticated users to /login.
 *   - Resolve the user's restaurant row (or null if they haven't started).
 *   - Redirect already-submitted / already-live restaurants to their status page.
 *   - Resume flow: if the user hits bare /onboarding but has progressed past
 *     Step 0, redirect to the step they left off on.
 *   - Render the two-pane layout: dark sidebar + cream main pane.
 */

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { ALL_STEPS } from '@/lib/onboarding/steps';
import MobileShellWrapper from './MobileShellWrapper';
import OnboardingSidebar from './OnboardingSidebar';

type OnboardingShellProps = {
  locale: 'nl' | 'en';
  children: React.ReactNode;
};

export default async function OnboardingShell({
  locale,
  children,
}: OnboardingShellProps) {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    const loginPath = locale === 'en' ? '/en/login' : '/login';
    redirect(loginPath);
  }

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();

  const localePrefix = locale === 'en' ? '/en' : '';

  const hdrs = await headers();
  const pathname = hdrs.get('x-pathname') ?? '';
  const strippedPath = pathname.replace(/^\/en/, '') || '/';

  if (restaurant) {
    if (restaurant.status === 'pending_review') {
      redirect(`${localePrefix}/onboarding/submitted`);
    }
    if (restaurant.status === 'live') {
      redirect(`${localePrefix}/onboarding/live`);
    }
    if (
      restaurant.status === 'suspended' ||
      restaurant.status === 'cancelled'
    ) {
      redirect(locale === 'en' ? '/en/login' : '/login');
    }

    // Resume flow: only fires when the user lands on the bare /onboarding URL.
    // Deep links to specific step pages are left alone so owners can revisit
    // earlier steps freely via the sidebar (PRD §3.3).
    const isBareOnboardingPath =
      strippedPath === '/onboarding' || strippedPath === '/onboarding/';
    const step = restaurant.current_onboarding_step ?? 0;
    if (isBareOnboardingPath && step >= 1) {
      const stepEntry = ALL_STEPS.find((s) => s.id === step);
      if (stepEntry && stepEntry.path !== '/onboarding') {
        redirect(`${localePrefix}${stepEntry.path}`);
      }
    }
  }

  const currentRouteStepId = resolveStepIdFromPath(pathname);

  return (
    <MobileShellWrapper
      sidebar={
        <OnboardingSidebar
          locale={locale}
          restaurant={restaurant ?? null}
          currentRouteStepId={currentRouteStepId}
        />
      }
    >
      {children}
    </MobileShellWrapper>
  );
}

function resolveStepIdFromPath(pathname: string): number | null {
  const stripped = pathname.replace(/^\/en/, '') || '/';
  const match = ALL_STEPS.find(
    (s) => stripped === s.path || stripped.startsWith(s.path + '/')
  );
  return match ? match.id : null;
}
