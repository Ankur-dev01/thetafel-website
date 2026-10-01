'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { aggregateRevenue, type RevenueDay, type RevenuePeriod } from '@/lib/dashboard/insights/compute';
import { BarSeries, RankedBars } from './Charts';

type Split = { key: string; label: string; cents: number };

type Props = {
  locale: 'nl' | 'en';
  days: RevenueDay[];
  totals: { ordersGrossCents: number; ordersVatCents: number; ordersNetCents: number; depositsCents: number; totalInclCents: number };
  perZone: Split[];
  perTable: Split[];
  perCategory: Split[];
  noShow: {
    noShows: number;
    noShowCovers: number;
    avgSpendPerCoverCents: number | null;
    estimateCents: number | null;
  };
};

const heading = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 600 } as const;
const body = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 400 } as const;
const muted = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontWeight: 300 } as const;

export default function RevenueSection({ locale, days, totals, perZone, perTable, perCategory, noShow }: Props) {
  const t = useTranslations('dashboard.insights.revenue');
  const [period, setPeriod] = useState<RevenuePeriod>('day');
  const tag = locale === 'en' ? 'en-GB' : 'nl-NL';
  const money = (c: number) => new Intl.NumberFormat(tag, { style: 'currency', currency: 'EUR' }).format(c / 100);
  const compact = (v: number) => new Intl.NumberFormat(tag, { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(v);

  const buckets = useMemo(() => aggregateRevenue(days, period), [days, period]);
  const fmtDay = new Intl.DateTimeFormat(tag, { timeZone: 'UTC', day: 'numeric', month: 'short' });
  const fmtMonth = new Intl.DateTimeFormat(tag, { timeZone: 'UTC', month: 'short', year: 'numeric' });
  const asDate = (d: string) => new Date(`${d}T12:00:00Z`);
  const labelOf = (key: string) => (period === 'month' ? fmtMonth.format(asDate(`${key}-01`)) : fmtDay.format(asDate(key)));
  const tooltipOf = (key: string) =>
    period === 'week' ? t('weekOf', { date: fmtDay.format(asDate(key)) }) : period === 'month' ? fmtMonth.format(asDate(`${key}-01`)) : fmtDay.format(asDate(key));

  const data = buckets.map((b) => ({
    label: labelOf(b.key),
    tooltipLabel: tooltipOf(b.key),
    value: Math.round((b.ordersGrossCents + b.depositsCents) / 100),
  }));
  const step = Math.max(1, Math.ceil(data.length / 10));
  const anyRevenue = totals.totalInclCents > 0;

  const chip = (active: boolean) =>
    `tafel-tap px-3.5 py-1.5 rounded-full text-[11px] uppercase tracking-[0.08em] ${active ? 'bg-amber text-[#1e1508]' : 'bg-[#f5ede0] text-[#6f6353]'}`;

  const splitCard = (title: string, rows: Split[], testId: string, note?: string) => (
    <div data-testid={testId}>
      <h3 className="text-[12px] uppercase tracking-[0.08em] text-[#8c8577] mb-2" style={heading}>{title}</h3>
      {rows.length === 0 ? (
        <p className="text-[13px] text-[#6f6353]" style={body}>{t('notEnough')}</p>
      ) : (
        <RankedBars rows={rows.map((r) => ({ label: r.key === 'other' ? t('other') : r.label, value: r.cents, display: money(r.cents) }))} />
      )}
      {note && <p className="mt-2 text-[11px] text-[#8c8577]" style={muted}>{note}</p>}
    </div>
  );

  return (
    <section className="mt-4 bg-white rounded-card p-5" data-testid="insights-revenue">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[16px] text-[#1e1508]" style={heading}>{t('title')}</h2>
          <p className="mt-0.5 text-[12px] text-[#8c8577]" style={muted}>{t('note')}</p>
        </div>
        <div className="flex gap-1.5" role="group" aria-label={t('toggle')}>
          {(['day', 'week', 'month'] as const).map((p) => (
            <button key={p} type="button" onClick={() => setPeriod(p)} aria-pressed={period === p} data-testid={`revenue-${p}`} className={chip(period === p)} style={heading}>
              {t(p)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2" data-testid="revenue-totals">
        {[
          [t('inclVat'), totals.totalInclCents, 'rev-total-incl'],
          [t('exclVat'), totals.ordersNetCents, 'rev-orders-excl'],
          [t('vat'), totals.ordersVatCents, 'rev-vat'],
          [t('deposits'), totals.depositsCents, 'rev-deposits'],
        ].map(([k, v, id]) => (
          <div key={id as string} className="rounded-card bg-[#f7f2e9] px-3 py-2.5">
            <div className="text-[11px] text-[#8c8577]" style={muted}>{k as string}</div>
            <div className="mt-0.5 text-[16px] text-[#1e1508]" style={heading} data-testid={id as string}>{money(v as number)}</div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-[#8c8577] leading-snug" style={muted}>
        {t('vatNote')} {t('depositsNote')}
      </p>

      {!anyRevenue ? null : (
        <div className="mt-4">
          <BarSeries testId="chart-revenue" names={[t('inclVat')]} data={data} xInterval={step - 1} format={compact} />
        </div>
      )}

      <div className="mt-6 flex flex-col gap-6">
        {splitCard(t('perZone'), perZone, 'revenue-zone')}
        {splitCard(t('perTable'), perTable, 'revenue-table')}
        {splitCard(t('perCategory'), perCategory, 'revenue-category', t('categoryNote'))}
      </div>

      <div className="mt-6 rounded-card bg-[#f7f2e9] px-4 py-4" data-testid="revenue-noshow">
        <div className="flex items-center gap-2">
          <h3 className="text-[14px] text-[#1e1508]" style={heading}>{t('noShowTitle')}</h3>
          <span className="rounded-full bg-[#fcf0d8] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.1em] text-[#8a5208]" style={heading}>{t('estimate')}</span>
        </div>
        {noShow.estimateCents === null || noShow.avgSpendPerCoverCents === null ? (
          <p className="mt-2 text-[14px] text-[#6f6353]" style={body} data-testid="noshow-notenough">{t('notEnough')}</p>
        ) : (
          <>
            <p className="mt-1 text-[22px] text-[#1e1508]" style={heading} data-testid="noshow-estimate">{money(noShow.estimateCents)}</p>
            <p className="mt-1 text-[12px] text-[#6f6353] leading-snug" style={body} data-testid="noshow-explain">
              {t('noShowExplain', { covers: noShow.noShowCovers, n: noShow.noShows, avg: money(noShow.avgSpendPerCoverCents) })}
            </p>
          </>
        )}
      </div>
    </section>
  );
}
