'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

export default function GuestExportButton() {
  const t = useTranslations('dashboard.guests');
  const locale = useLocale();
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

  async function run() {
    setBusy(true);
    setToast(null);
    try {
      const res = await fetch(`/api/dashboard/guests/export?locale=${locale === 'en' ? 'en' : 'nl'}`, { cache: 'no-store' });
      if (res.status === 429) {
        setToast({ ok: false, text: t('export.rateLimited') });
      } else if (!res.ok) {
        setToast({ ok: false, text: t('export.error') });
      } else {
        const rows = Number(res.headers.get('X-Row-Count') ?? '0');
        const filename = /filename="([^"]+)"/.exec(res.headers.get('Content-Disposition') ?? '')?.[1] ?? 'gasten.csv';
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        setToast({ ok: true, text: t('export.done', { count: rows }) });
      }
    } catch {
      setToast({ ok: false, text: t('export.error') });
    }
    setBusy(false);
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        data-testid="guests-export"
        className="tafel-tap shrink-0 px-4 py-3 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#1e1508] disabled:opacity-50"
        style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 }}
      >
        {busy ? t('export.working') : t('export.button')}
      </button>
      {toast && (
        <span
          role={toast.ok ? 'status' : 'alert'}
          data-testid="guests-export-toast"
          className={`text-[13px] ${toast.ok ? 'text-[#2f6b3d]' : 'text-[#b3422f]'}`}
          style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 }}
        >
          {toast.text}
        </span>
      )}
    </div>
  );
}
