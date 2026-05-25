'use client';

import { usePathname } from 'next/navigation';
import { setLocale } from '@/app/actions/setLocale';

type LanguageToggleProps = {
  locale: 'nl' | 'en';
};

export default function LanguageToggle({ locale }: LanguageToggleProps) {
  const pathname = usePathname();

  return (
    <div className="flex items-center gap-0.5 bg-white/5 rounded-full p-0.5 text-[11px] font-medium">
      {(['nl', 'en'] as const).map((option) => {
        const isActive = option === locale;
        return (
          <form key={option} action={setLocale}>
            <input type="hidden" name="locale" value={option} />
            <input type="hidden" name="path" value={pathname ?? '/onboarding'} />
            <button
              type="submit"
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
          </form>
        );
      })}
    </div>
  );
}
