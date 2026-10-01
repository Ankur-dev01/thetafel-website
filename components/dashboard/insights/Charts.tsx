'use client';

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

/**
 * Brand-styled charts for Insights. Hand-tuned recharts: amber is the single
 * accent (#d4820a), earth (#1e1508) is the secondary series, cream surface, Jost
 * labels, no grid lines, no default library tooltip. Always full width of the
 * container (ResponsiveContainer) so phones never scroll horizontally.
 */

export const AMBER = '#d4820a';
export const EARTH = '#1e1508';
const STONE = '#8c8577';

const tick = { fontFamily: 'var(--font-jost), Jost, sans-serif', fontSize: 11, fill: '#6f6353' } as const;

export type BarDatum = { label: string; value: number; value2?: number; tooltipLabel?: string };

function BrandTooltip({
  active,
  payload,
  names,
  format,
}: { active?: boolean; payload?: ReadonlyArray<{ payload?: unknown }>; names: [string, string?]; format?: (v: number) => string }) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as BarDatum;
  return (
    <div
      className="rounded-[10px] bg-white px-3 py-2 shadow-[0_8px_24px_rgba(30,21,8,0.16)] border border-[#f0e8d6]"
      style={{ fontFamily: 'var(--font-jost), Jost, sans-serif' }}
    >
      <div className="text-[12px] text-[#1e1508]" style={{ fontWeight: 600 }}>
        {d.tooltipLabel ?? d.label}
      </div>
      <div className="mt-0.5 text-[12px] text-[#6f6353]">
        {names[0]}: <span className="text-[#1e1508]">{format ? format(d.value) : d.value}</span>
      </div>
      {names[1] && d.value2 !== undefined && (
        <div className="text-[12px] text-[#6f6353]">
          {names[1]}: <span className="text-[#1e1508]">{d.value2}</span>
        </div>
      )}
    </div>
  );
}

export function BarSeries({
  data,
  names,
  height = 220,
  twoSeries = false,
  xInterval,
  format,
  testId,
}: {
  data: BarDatum[];
  names: [string, string?];
  height?: number;
  twoSeries?: boolean;
  /** Show every Nth x label (long ranges). */
  xInterval?: number;
  format?: (v: number) => string;
  testId?: string;
}) {
  return (
    <div style={{ width: '100%', height }} data-testid={testId} role="img" aria-label={names[0]}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barCategoryGap={twoSeries ? '22%' : '28%'}>
          <XAxis dataKey="label" tick={tick} tickLine={false} axisLine={{ stroke: '#e7ddc9' }} interval={xInterval ?? 'preserveStartEnd'} />
          <YAxis tick={tick} tickLine={false} axisLine={false} allowDecimals={false} width={46} tickFormatter={format} />
          <Tooltip cursor={{ fill: 'rgba(212,130,10,0.08)' }} content={(p) => <BrandTooltip active={p.active} payload={p.payload} names={names} format={format} />} />
          <Bar dataKey="value" fill={AMBER} radius={[4, 4, 0, 0]} isAnimationActive={false} />
          {twoSeries && <Bar dataKey="value2" fill={EARTH} fillOpacity={0.78} radius={[4, 4, 0, 0]} isAnimationActive={false} />}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Horizontal ranked bars (distributions, top dishes). Pure CSS — crisp, accessible, no axis clutter. */
export function RankedBars({
  rows,
  unit,
  testId,
}: {
  rows: { label: string; value: number; display?: string }[];
  unit?: string;
  testId?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-2" data-testid={testId}>
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[minmax(0,40%)_1fr_auto] items-center gap-3 text-[13px]" style={{ fontFamily: 'var(--font-jost), Jost, sans-serif' }}>
          <span className="truncate text-[#1e1508]" style={{ fontWeight: 400 }} title={r.label}>
            {r.label}
          </span>
          <span className="h-2.5 rounded-full bg-[#f3ecdc] overflow-hidden" aria-hidden="true">
            <span className="block h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: AMBER }} />
          </span>
          <span className="text-[#6f6353] tabular-nums" style={{ fontWeight: 600 }}>
            {r.display ?? r.value}
            {unit ? ` ${unit}` : ''}
          </span>
        </li>
      ))}
    </ul>
  );
}

export { STONE };
