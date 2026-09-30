/**
 * DashboardShell
 *
 * Server component. Mounts the resolved dashboard context into the
 * responsive chrome: dark sidebar (desktop) + phone bottom tab bar + sticky
 * header. Auth and membership resolution happen in the layout via
 * resolveDashboardContext before this renders.
 */

import type { DashboardContext } from '@/lib/dashboard/resolveDashboardContext';
import { navItemsForRole } from '@/lib/dashboard/nav';
import MobileShellWrapper from './MobileShellWrapper';
import DashboardSidebar from './DashboardSidebar';
import PhoneTabBar from './PhoneTabBar';
import DashboardHeader from './DashboardHeader';
import BillingPastDueBanner from './BillingPastDueBanner';
import StaffLanguageSync from './StaffLanguageSync';

type DashboardShellProps = {
  locale: 'nl' | 'en';
  context: DashboardContext;
  /** Formatted offline date when the subscription is past_due, else null. */
  pastDueOfflineDate?: string | null;
  children: React.ReactNode;
};

export default function DashboardShell({
  locale,
  context,
  pastDueOfflineDate = null,
  children,
}: DashboardShellProps) {
  const { restaurant, staff } = context;

  // Never fall back to "The Tafel" — the restaurant's own name only.
  const restaurantName =
    restaurant.display_name ??
    restaurant.trade_name ??
    restaurant.legal_name ??
    restaurant.name;

  const items = navItemsForRole(staff.role);

  const banner = pastDueOfflineDate ? (
    <div className="pt-4">
      <BillingPastDueBanner locale={locale} offlineDate={pastDueOfflineDate} />
    </div>
  ) : null;

  // Kitchen: single-purpose, full-screen order queue — no sidebar, no tab bar,
  // no navigation; only language, account and log out in the header.
  const languageSync = <StaffLanguageSync locale={locale} staffLanguage={staff.language} />;

  if (staff.role === 'kitchen') {
    return (
      <div className="min-h-screen bg-cream text-[#1e1508]" data-testid="kitchen-shell">
        {languageSync}
        <DashboardHeader
          locale={locale}
          restaurantName={restaurantName}
          paused={restaurant.paused_at !== null}
          showLogout
        />
        <main className="px-4 md:px-8 pb-10">
          {banner}
          {children}
        </main>
      </div>
    );
  }

  return (
    <MobileShellWrapper
      sidebar={
        <DashboardSidebar
          locale={locale}
          restaurantName={restaurantName}
          items={items}
        />
      }
      tabBar={<PhoneTabBar locale={locale} items={items} />}
      header={
        <DashboardHeader
          locale={locale}
          restaurantName={restaurantName}
          paused={restaurant.paused_at !== null}
        />
      }
    >
      {languageSync}
      {banner}
      {children}
    </MobileShellWrapper>
  );
}
