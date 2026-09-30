'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from '@/i18n/routing';

/**
 * Per-staff language (PRD §2.1): after login, land in the staff member's own
 * language (restaurant_staff.language) when the URL locale differs. Runs ONCE
 * per browser-tab session (sessionStorage flag) so a later manual NL/EN toggle
 * is never fought.
 */
const FLAG = 'tafel_staff_lang_synced';

export default function StaffLanguageSync({
  locale,
  staffLanguage,
}: {
  locale: 'nl' | 'en';
  staffLanguage: 'nl' | 'en';
}) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(FLAG)) return;
      window.sessionStorage.setItem(FLAG, '1');
    } catch {
      return; // storage blocked: never redirect-loop
    }
    if (staffLanguage !== locale) {
      router.replace(pathname, { locale: staffLanguage });
    }
  }, [locale, staffLanguage, pathname, router]);

  return null;
}
