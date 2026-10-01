'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/routing';

type Props = { preset: '7' | '30' | '90' | 'custom'; from: string; to: string; maxDate: string };

const label = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const;

export default function RangePicker({ preset, from, to, maxDate }: Props) {
  const t = useTranslations('dashboard.insights.range');
  const router = useRouter();
  const pathname = usePathname();
  const [custom, setCustom] = useState({ from, to });
  const [showCustom, setShowCustom] = useState(preset === 'custom');

  function go(params: Record<string, string>) {
    router.push(`${pathname}?${new URLSearchParams(params).toString()}`);
  }

  const chip = (active: boolean) =>
    `tafel-tap px-4 py-2 rounded-full text-[12px] uppercase tracking-[0.08em] ${active ? 'bg-amber text-[#1e1508]' : 'bg-white text-[#6f6353]'}`;

  return (
    <div className="flex flex-col gap-2" data-testid="insights-range">
      <div className="flex flex-wrap gap-2">
        {(['7', '30', '90'] as const).map((n) => (
          <button key={n} type="button" onClick={() => { setShowCustom(false); go({ range: n }); }} className={chip(preset === n)} style={label} data-testid={`range-${n}`} aria-pressed={preset === n}>
            {t('days', { n })}
          </button>
        ))}
        <button type="button" onClick={() => setShowCustom(true)} className={chip(preset === 'custom' || showCustom)} style={label} data-testid="range-custom" aria-pressed={preset === 'custom'}>
          {t('custom')}
        </button>
      </div>
      {showCustom && (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (custom.from && custom.to) go({ range: 'custom', from: custom.from, to: custom.to });
          }}
        >
          {(['from', 'to'] as const).map((k) => (
            <label key={k} className="block">
              <span className="block text-[11px] text-[#6f6353] mb-1" style={label}>{t(k)}</span>
              <input
                type="date"
                value={custom[k]}
                max={maxDate}
                onChange={(e) => setCustom((c) => ({ ...c, [k]: e.target.value }))}
                data-testid={`range-${k}`}
                className="rounded-[10px] border border-[#e7ddc9] bg-white px-3 py-2 text-[14px] text-[#1e1508]"
              />
            </label>
          ))}
          <button type="submit" className="tafel-tap px-4 py-2.5 rounded-full text-[12px] uppercase tracking-[0.08em] bg-[#f5ede0] text-[#1e1508]" style={label} data-testid="range-apply">
            {t('apply')}
          </button>
          <span className="text-[11px] text-[#8c8577] pb-2.5" style={{ fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 300 }}>
            {t('max')}
          </span>
        </form>
      )}
    </div>
  );
}
