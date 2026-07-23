'use client';

import { useState } from 'react';
import { Link, usePathname } from '@/i18n/routing';
import type { DashboardNavItem } from '@/lib/dashboard/nav';
import { activeNavKey } from '@/lib/dashboard/nav';
import { NavIcon } from './navIcons';
import MoreSheet from './MoreSheet';

/**
 * Phone bottom tab bar (< 768px): Vandaag · Reserveringen · Bestellingen · Meer.
 * "Meer" opens a bottom sheet with the remaining sections.
 */

type PhoneTabBarProps = {
  locale: 'nl' | 'en';
  items: DashboardNavItem[];
};

export default function PhoneTabBar({ locale, items }: PhoneTabBarProps) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const active = activeNavKey(pathname || '/');

  const tabItems = items.filter((i) => i.phoneTab);
  const moreItems = items.filter((i) => !i.phoneTab);
  const moreIsActive = moreItems.some((i) => i.key === active);
  const moreLabel = locale === 'nl' ? 'Meer' : 'More';

  const labelStyle = {
    fontFamily: 'var(--font-jost), Jost, sans-serif',
    fontWeight: 600,
  } as const;

  return (
    <>
      <MoreSheet
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        locale={locale}
        items={moreItems}
      />

      <nav
        aria-label={locale === 'nl' ? 'Hoofdnavigatie' : 'Main navigation'}
        className="md:hidden fixed inset-x-0 bottom-0 z-30 bg-cream shadow-[0_-2px_12px_rgba(30,21,8,0.08)] pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="flex">
          {tabItems.map((item) => {
            const isActive = active === item.key && !moreOpen;
            const label = locale === 'nl' ? item.label_nl : item.label_en;
            return (
              <li key={item.key} className="flex-1">
                <Link
                  href={item.path}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setMoreOpen(false)}
                  className={
                    'tafel-tap flex flex-col items-center gap-1 pt-2.5 pb-2 ' +
                    (isActive ? 'text-amber' : 'text-[#6f6353]')
                  }
                >
                  <NavIcon icon={item.icon} />
                  <span className="text-[10px] leading-none" style={labelStyle}>
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
          <li className="flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
              className={
                'tafel-tap w-full flex flex-col items-center gap-1 pt-2.5 pb-2 ' +
                (moreOpen || moreIsActive ? 'text-amber' : 'text-[#6f6353]')
              }
            >
              <NavIcon icon="more" />
              <span className="text-[10px] leading-none" style={labelStyle}>
                {moreLabel}
              </span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
