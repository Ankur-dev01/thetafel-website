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
 *   - Render the two-pane layout: dark sidebar + cream main pane.
 */

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createSupabaseServerClient, createSupabaseServerClientAdmin } from '@/lib/supabase/server';
import { ALL_STEPS, getVisibleSteps, resolveStepIdFromPath } from '@/lib/onboarding/steps';
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
    const submittedPath = `${localePrefix}/onboarding/submitted`;
    const dashboardPath = `${localePrefix}/dashboard`;
    const currentPath = (pathname.split('?')[0].split('#')[0] || '').replace(/\/+$/, '') || '/';

    if (restaurant.status === 'pending_review' && currentPath !== submittedPath) {
      redirect(submittedPath);
    }
    if (restaurant.status === 'live') {
      redirect(dashboardPath);
    }
    if (
      restaurant.status === 'suspended' ||
      restaurant.status === 'cancelled'
    ) {
      redirect(locale === 'en' ? '/en/login' : '/login');
    }

    const visibleSteps = getVisibleSteps(restaurant);

    // Guard: if navigating directly to a step whose service is disabled, bounce
    // to the service picker. This handles typed URLs and stale sidebar links.
    const currentRouteStep = strippedPath !== '/onboarding' && strippedPath !== '/onboarding/'
      ? ALL_STEPS.find((s) => s.path === strippedPath)
      : null;
    if (currentRouteStep && currentRouteStep.services.length > 0) {
      const isVisible = visibleSteps.some((s) => s.id === currentRouteStep.id);
      if (!isVisible) {
        redirect(`${localePrefix}/onboarding`);
      }
    }
  }

  const currentRouteStepId = resolveStepIdFromPath(pathname);

  // If the URL step is ahead of the DB (e.g. webhook fired but DB hasn't
  // updated yet), backfill race-safely so the sidebar renders correctly on
  // the next request without waiting for the next full webhook cycle.
  if (
    restaurant &&
    currentRouteStepId !== null &&
    currentRouteStepId > (restaurant.current_onboarding_step ?? 0)
  ) {
    const admin = await createSupabaseServerClientAdmin()
    void admin
      .from('restaurants')
      .update({ current_onboarding_step: currentRouteStepId })
      .eq('id', restaurant.id)
      .lt('current_onboarding_step', currentRouteStepId)
      .then(() => {}, () => {})
  }

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

