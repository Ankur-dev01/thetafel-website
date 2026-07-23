'use client';

import { Link, usePathname } from '@/i18n/routing';
import type { DashboardNavItem } from '@/lib/dashboard/nav';
import { activeNavKey } from '@/lib/dashboard/nav';
import { NavIcon } from './navIcons';

/**
 * Desktop sidebar (≥ 768px). Dark tone matching onboarding's sidebar.
 * Between 768px and 1100px it collapses to a 64px icon rail (labels hidden,
 * native tooltips via title=). At ≥ 1100px the full 240px sidebar renders.
 */

type DashboardSidebarProps = {
  locale: 'nl' | 'en';
  restaurantName: string;
  items: DashboardNavItem[];
};

export default function DashboardSidebar({
  locale,
  restaurantName,
  items,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const active = activeNavKey(pathname || '/');

  const t = {
    nl: { eyebrow: 'RESTAURANT', help: 'Hulp nodig? Mail ons — we reageren snel.', cta: 'hallo@thetafel.nl' },
    en: { eyebrow: 'RESTAURANT', help: 'Need help? Email us — we respond quickly.', cta: 'hallo@thetafel.nl' },
  }[locale];

  return (
    <div className="flex flex-col h-full py-6 px-3 min-[1100px]:px-6 gap-6">
      {/* Wordmark */}
      <div className="px-2 min-[1100px]:px-0">
        <div
          className="text-[11px] tracking-[0.18em] text-amber leading-none"
          style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif', fontWeight: 900 }}
        >
          THE
        </div>
        <div
          className="text-[22px] min-[1100px]:text-[28px] text-[#fdfaf5] leading-none mt-1"
          style={{ fontFamily: 'var(--font-raleway), Raleway, sans-serif', fontWeight: 900 }}
        >
          T<span className="hidden min-[1100px]:inline">afel</span>
        </div>
        <div
          className="hidden min-[1100px]:block text-[9px] tracking-[0.22em] text-[#9c8b6a] mt-3 uppercase"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {t.eyebrow}
        </div>
        <div
          className="hidden min-[1100px]:block text-[13px] text-[#fdfaf5]/90 mt-1 truncate"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          title={restaurantName}
        >
          {restaurantName}
        </div>
      </div>

      {/* Nav */}
      <nav aria-label={locale === 'nl' ? 'Dashboardnavigatie' : 'Dashboard navigation'} className="flex-1 overflow-y-auto">
        <ul className="flex flex-col gap-1">
          {items.map((item) => {
            const isActive = active === item.key;
            const label = locale === 'nl' ? item.label_nl : item.label_en;
            return (
              <li key={item.key}>
                <Link
                  href={item.path}
                  title={label}
                  aria-current={isActive ? 'page' : undefined}
                  className={
                    'tafel-tap flex items-center gap-3 py-2.5 px-2 min-[1100px]:px-3 rounded transition-colors border-l-2 ' +
                    (isActive
                      ? 'border-amber text-amber bg-white/5'
                      : 'border-transparent text-[#fdfaf5]/70 hover:text-[#fdfaf5] hover:bg-white/5')
                  }
                >
                  <NavIcon icon={item.icon} className="flex-shrink-0" />
                  <span
                    className="hidden min-[1100px]:inline text-[13px] leading-snug"
                    style={{
                      fontFamily: 'var(--font-jost), Jost, sans-serif',
                      fontWeight: isActive ? 600 : 500,
                    }}
                  >
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Help block */}
      <div className="hidden min-[1100px]:block border-t border-white/10 pt-4">
        <p
          className="text-[12px] text-[#9c8b6a] leading-relaxed mb-2"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}
        >
          {t.help}
        </p>
        <a
          href="mailto:hallo@thetafel.nl"
          className="tafel-tap block w-full text-center px-4 py-2.5 rounded bg-white/10 hover:bg-white/15 text-[#fdfaf5] text-[12px] tracking-[0.08em] transition-colors"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {t.cta}
        </a>
      </div>
    </div>
  );
}
