'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { useTranslations, useLocale } from 'next-intl';
import ConfirmDialog from '@/components/dashboard/ui/ConfirmDialog';
import { pauseRestaurant, resumeRestaurant } from '@/lib/dashboard/actions/pauseResume';

type PauseControlProps = {
  initialPausedAt: string | null;
  initialPauseReason: 'manual' | 'billing_suspended' | null;
};

export default function PauseControl({ initialPausedAt, initialPauseReason }: PauseControlProps) {
  const t = useTranslations('dashboard.settings');
  const locale = useLocale();
  const router = useRouter();

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const state: 'live' | 'paused' | 'billing' =
    initialPausedAt === null
      ? 'live'
      : initialPauseReason === 'billing_suspended'
        ? 'billing'
        : 'paused';

  const handlePauseConfirm = async () => {
    setPending(true);
    setError(null);
    const result = await pauseRestaurant();
    setPending(false);
    setConfirmOpen(false);
    if (result.ok) {
      router.refresh();
    } else {
      setError(result.error);
    }
  };

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

  // Explicit timeZone — server render (host machine tz) and client hydration
  // (browser tz) must agree, or React flags a hydration mismatch. Amsterdam
  // matches every other wall-clock display in the dashboard.
  const formattedPausedAt = initialPausedAt
    ? new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : 'nl-NL', {
        timeZone: 'Europe/Amsterdam',
        day: 'numeric',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(initialPausedAt))
    : '';

  return (
    <div className="bg-white rounded-card p-5">
      {state === 'live' && (
        <>
          <h3
            className="text-[16px] text-[#1e1508]"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            {t('status.live.title')}
          </h3>
          <p
            className="mt-1.5 text-[14px] text-[#6f6353] leading-relaxed"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}
          >
            {t('status.live.body')}
          </p>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            className="tafel-tap mt-4 px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f7e8e6] text-[#b3422f]"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            {t('status.live.action')}
          </button>
        </>
      )}

      {state === 'paused' && (
        <>
          <h3
            className="text-[16px] text-[#1e1508]"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            {t('status.paused.title', { when: formattedPausedAt })}
          </h3>
          <p
            className="mt-1.5 text-[14px] text-[#6f6353] leading-relaxed"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}
          >
            {t('status.paused.body')}
          </p>
          <button
            type="button"
            onClick={handleResume}
            disabled={pending}
            className="tafel-tap mt-4 px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508]"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            {pending ? '…' : t('status.paused.action')}
          </button>
        </>
      )}

      {state === 'billing' && (
        <>
          <h3
            className="text-[16px] text-[#1e1508]"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            {t('status.billing.title')}
          </h3>
          <p
            className="mt-1.5 text-[14px] text-[#6f6353] leading-relaxed"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}
          >
            {t('status.billing.body')}
          </p>
          <Link
            href="/dashboard/settings/billing"
            className="tafel-tap inline-block mt-4 px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-amber text-[#1e1508]"
            style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
          >
            {t('status.billing.action')}
          </Link>
        </>
      )}

      {error && (
        <div
          className="mt-3 text-[12px] text-[#b3422f]"
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 500 }}
        >
          {error}
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={handlePauseConfirm}
        title={t('confirmPause.title')}
        body={t('confirmPause.body')}
        confirmLabel={t('confirmPause.confirm')}
        cancelLabel={t('confirmPause.cancel')}
        destructive
        pending={pending}
      />
    </div>
  );
}
