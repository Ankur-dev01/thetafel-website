'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Pause } from '@/components/dashboard/icons';
import { resumeRestaurant } from '@/lib/dashboard/actions/pauseResume';

type PauseBannerProps = {
  pausedAt: string;
  pauseReason: 'manual' | 'billing_suspended';
};

export default function PauseBanner({ pausedAt, pauseReason }: PauseBannerProps) {
  void pausedAt;
  const t = useTranslations('dashboard.pause.banner');
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ns = pauseReason === 'manual' ? 'manual' : 'billing';

  const handleResume = async () => {
    setPending(true);
    setError(null);
    const result = await resumeRestaurant();
    setPending(false);
    if (result.ok) {
      router.refresh();
    } else {
      setError(result.error);
    }
  };

  return (
    <div className="max-md:sticky max-md:top-0 max-md:z-10 bg-[#fcf0d8] rounded-card p-4 md:p-5 flex items-center gap-4">
      <Pause className="w-5 h-5 text-[#a86205] flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div
          className="text-[14px] text-[#1e1508]"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {t(`${ns}.title`)}
        </div>
        <div
          className="text-[13px] text-[#6f6353] mt-0.5"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}
        >
          {t(`${ns}.body`)}
        </div>
        {error && (
          <div
            className="text-[12px] text-[#b3422f] mt-1"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}
          >
            {error}
          </div>
        )}
      </div>
      {pauseReason === 'manual' ? (
        <button
          type="button"
          onClick={handleResume}
          disabled={pending}
          className="tafel-tap flex-shrink-0 px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508]"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {pending ? '…' : t(`${ns}.action`)}
        </button>
      ) : (
        <Link
          href="/dashboard/settings/billing"
          className="tafel-tap flex-shrink-0 px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508]"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
        >
          {t(`${ns}.action`)}
        </Link>
      )}
    </div>
  );
}
