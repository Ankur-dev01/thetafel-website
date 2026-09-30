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
      {pastDueOfflineDate && (
        <div className="pt-4">
          <BillingPastDueBanner locale={locale} offlineDate={pastDueOfflineDate} />
        </div>
      )}
      {children}
    </MobileShellWrapper>
  );
}
