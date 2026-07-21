'use client';

import { useState, useEffect, useTransition } from 'react';
import { usePathname, useRouter } from '@/i18n/routing';
import { updateLocalePreference } from '@/app/actions/setLocale';

/**
 * Dashboard language toggle — same instant-optimistic behaviour as the
 * onboarding LanguageToggle, restyled for the cream header chrome.
 */

type LanguageToggleProps = {
  locale: 'nl' | 'en';
};

export default function LanguageToggle({ locale }: LanguageToggleProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [optimisticLocale, setOptimisticLocale] = useState<'nl' | 'en'>(locale);

  useEffect(() => {
    setOptimisticLocale(locale);
  }, [locale]);

  const switchTo = (target: 'nl' | 'en') => {
    if (target === optimisticLocale) return;
    setOptimisticLocale(target);
    void updateLocalePreference(target);
    startTransition(() => {
      router.replace(pathname, { locale: target });
    });
  };

  return (
    <div className="flex items-center gap-0.5 bg-[rgba(30,21,8,0.06)] rounded-full p-0.5 text-[11px]">
      {(['nl', 'en'] as const).map((option) => {
        const isActive = option === optimisticLocale;
        return (
          <button
            key={option}
            type="button"
            onClick={() => switchTo(option)}
            disabled={isPending && option !== optimisticLocale}
            className={
              'tafel-tap px-3 py-1 rounded-full uppercase tracking-[0.15em] ' +
              (isActive
                ? 'bg-amber text-[#1e1508]'
                : 'text-[#6f6353] hover:text-[#1e1508] transition-colors')
            }
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
            aria-label={option === 'nl' ? 'Switch to Dutch' : 'Switch to English'}
            aria-pressed={isActive}
          >
            {option.toUpperCase()}
          </button>
        );
      })}
    </div>
  );
}
