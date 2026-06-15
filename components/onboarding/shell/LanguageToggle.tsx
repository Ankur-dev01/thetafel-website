'use client';

import { usePathname, useRouter } from '@/i18n/routing';
import { updateLocalePreference } from '@/app/actions/setLocale';

type LanguageToggleProps = {
  locale: 'nl' | 'en';
};

export default function LanguageToggle({ locale }: LanguageToggleProps) {
  const router = useRouter();
  const pathname = usePathname();

  const switchTo = (target: 'nl' | 'en') => {
    if (target === locale) return;
    // Persist the preference asynchronously — don't block navigation
    void updateLocalePreference(target);
    // Client-side navigation: no full page reload, no JS re-download
    router.replace(pathname, { locale: target });
  };

  return (
    <div className="flex items-center gap-0.5 bg-white/5 rounded-full p-0.5 text-[11px] font-medium">
      {(['nl', 'en'] as const).map((option) => {
        const isActive = option === locale;
        return (
          <button
            key={option}
            onClick={() => switchTo(option)}
            className={
              isActive
                ? 'px-3 py-1 rounded-full bg-[#d4820a] text-[#1e1508] uppercase tracking-[0.15em]'
                : 'px-3 py-1 rounded-full text-[#fdfaf5]/70 hover:text-[#fdfaf5] uppercase tracking-[0.15em] transition-colors'
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
