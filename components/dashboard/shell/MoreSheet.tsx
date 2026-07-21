'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import type { DashboardNavItem } from '@/lib/dashboard/nav';
import { NavIcon } from './navIcons';

/**
 * Phone "Meer" bottom sheet — slides up over the tab bar with the secondary
 * sections (Tabs, Gasten, Menu, Inzichten, Instellingen). Dismisses on
 * backdrop tap or any item tap.
 */

type MoreSheetProps = {
  open: boolean;
  onClose: () => void;
  locale: 'nl' | 'en';
  items: DashboardNavItem[];
};

export default function MoreSheet({ open, onClose, locale, items }: MoreSheetProps) {
  const localePrefix = locale === 'en' ? '/en' : '';

  // Prevent body scroll while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={
          'md:hidden fixed inset-0 bg-black/40 z-40 transition-opacity duration-200 ' +
          (open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none')
        }
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={locale === 'nl' ? 'Meer secties' : 'More sections'}
        aria-hidden={!open}
        className={
          'md:hidden fixed inset-x-0 bottom-0 z-50 bg-cream rounded-t-card shadow-[0_-8px_30px_rgba(30,21,8,0.15)] transition-transform duration-200 ' +
          (open ? 'translate-y-0' : 'translate-y-full')
        }
      >
        <div className="w-10 h-1 rounded-full bg-[#ead9b6] mx-auto mt-3" aria-hidden="true" />
        <nav className="p-4 pb-8">
          <ul className="flex flex-col">
            {items.map((item) => {
              const label = locale === 'nl' ? item.label_nl : item.label_en;
              return (
                <li key={item.key}>
                  <Link
                    href={`${localePrefix}${item.path}`}
                    onClick={onClose}
                    tabIndex={open ? 0 : -1}
                    className="tafel-tap flex items-center gap-4 py-3.5 px-3 rounded-card text-[#1e1508] hover:bg-[#f5ede0] transition-colors"
                  >
                    <NavIcon icon={item.icon} className="text-[#6f6353]" />
                    <span
                      className="text-[15px]"
                      style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}
                    >
                      {label}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </>
  );
}
