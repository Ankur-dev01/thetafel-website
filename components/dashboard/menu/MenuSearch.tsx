'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from '@/i18n/routing';
import { useSearchParams } from 'next/navigation';

const DEBOUNCE_MS = 300;

type MenuSearchProps = {
  initialValue: string;
};

export default function MenuSearch({ initialValue }: MenuSearchProps) {
  const t = useTranslations('dashboard.menu.search');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [value, setValue] = useState(initialValue);
  const isFirstRender = useRef(true);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setValue(initialValue);
  }, [initialValue]);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const trimmed = value.trim();
      if (trimmed) params.set('q', trimmed);
      else params.delete('q');
      // A new search scope invalidates whichever item panel was open.
      params.delete('item');
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }, DEBOUNCE_MS);
    return () => {
      if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <input
      type="search"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      placeholder={t('placeholder')}
      data-testid="menu-search"
      className="tafel-tap w-full rounded-full border border-[#e7ddc9] bg-white px-4 py-2.5 text-[14px] text-[#1e1508] focus:outline-none focus:ring-2 focus:ring-amber"
      style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}
    />
  );
}
